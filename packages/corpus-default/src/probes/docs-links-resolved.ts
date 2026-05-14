import path from "node:path";
import type { InventoryItem } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const DOC_SOURCES: RegExp[] = [
  /^README\.md$/i,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^CONTRIBUTING\.md$/i,
  /^docs\//i,
  /^specs\//i,
];

const MD_LINK_RE = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternal(href: string): boolean {
  return /^(?:https?:|mailto:|tel:|ftp:|ws:|wss:)/i.test(href);
}

function stripFragment(href: string): { path: string; fragment: string } {
  const hash = href.indexOf("#");
  if (hash < 0) return { path: href, fragment: "" };
  return { path: href.slice(0, hash), fragment: href.slice(hash + 1) };
}

function isDocSource(p: string): boolean {
  return DOC_SOURCES.some((re) => re.test(p));
}

export default defineProbe({
  id: "docs.links-resolved",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["files", "size_stats"],

  rationale: `
    Broken relative links in README.md, CLAUDE.md, AGENTS.md, or docs/
    teach agents (and humans) to mistrust the docs. They also waste
    context: an agent that follows a dead pointer reads nothing and is
    no smarter than before. This probe scans the canonical doc sources
    for markdown links \`[text](path)\`, ignores external URLs and
    anchor-only fragments, and verifies each relative path resolves to
    a tracked file (or to a directory that contains files).
  `,

  remediation:
    "Fix or remove broken pointers. Update the path if the file moved (`git log --diff-filter=R` finds renames). If the linked content no longer exists, replace the link with the new home or delete the reference. For external sites, use full URLs (`https://...`) which this probe doesn't validate.",

  async detect(ev) {
    const allPaths = ev.size_stats.files.map((f) => f.path);
    const fileSet = new Set(allPaths);
    const dirSet = new Set<string>();
    for (const p of allPaths) {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirSet.add(parts.slice(0, i).join("/"));
      }
    }

    const docs = allPaths.filter(isDocSource);
    if (docs.length === 0) {
      return { kind: "na", reason: "no doc sources (README/CLAUDE/AGENTS/docs/specs) found" };
    }

    const items: InventoryItem[] = [];
    for (const docPath of docs) {
      const raw = await ev.files.readText(docPath);
      if (!raw) continue;
      const docDir = path.posix.dirname(docPath);
      MD_LINK_RE.lastIndex = 0;
      for (const m of raw.matchAll(MD_LINK_RE)) {
        const href = m[3];
        if (!href) continue;
        if (isExternal(href)) continue;
        const { path: hrefPath } = stripFragment(href);
        if (hrefPath.length === 0) continue;
        const resolved = path.posix
          .normalize(docDir === "." ? hrefPath : path.posix.join(docDir, hrefPath))
          .replace(/\/+$/, "");
        if (resolved.startsWith("..")) continue;
        if (fileSet.has(resolved) || dirSet.has(resolved)) continue;
        const offset = m.index ?? 0;
        const line = (raw.slice(0, offset).match(/\n/g)?.length ?? 0) + 1;
        items.push({
          location: { path: docPath, range: { startLine: line } },
          severity: "warn",
          message: `broken link → ${href}`,
        });
      }
    }

    return { kind: "inventory", items };
  },

  score: {
    kind: "inventory",
    severityWeights: { info: 1, warn: 1, error: 1 },
    bands: [
      { upTo: 0, score: 100 },
      { upTo: 1, score: 80 },
      { upTo: 3, score: 60 },
      { upTo: 6, score: 30 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "no-doc-sources",
      evidence: {
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "src/index.ts", bytes: 50, lines: 3, depth: 1 }],
        },
      },
      expect: {
        reading: {
          kind: "na",
          reason: "no doc sources (README/CLAUDE/AGENTS/docs/specs) found",
        },
        score: null,
      },
    },
    {
      name: "all-links-valid",
      evidence: {
        files: {
          "README.md":
            "See [arch](docs/arch.md) and [the source](src/index.ts) and [github](https://github.com).",
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 300,
          totalFiles: 3,
          files: [
            { path: "README.md", bytes: 100, lines: 3, depth: 0 },
            { path: "docs/arch.md", bytes: 100, lines: 3, depth: 1 },
            { path: "src/index.ts", bytes: 100, lines: 3, depth: 1 },
          ],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "one-broken",
      evidence: {
        files: { "README.md": "See [arch](docs/arch.md) and [missing](docs/gone.md)." },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "README.md", bytes: 100, lines: 1, depth: 0 },
            { path: "docs/arch.md", bytes: 100, lines: 1, depth: 1 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "README.md", range: { startLine: 1 } },
              severity: "warn",
              message: "broken link → docs/gone.md",
            },
          ],
        },
        score: 80,
      },
    },
    {
      name: "external-and-anchor-ignored",
      evidence: {
        files: {
          "CLAUDE.md":
            "Visit [site](https://example.com) or [section](#installing) — those are not validated.",
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "CLAUDE.md", bytes: 100, lines: 1, depth: 0 }],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "fragment-on-existing-file-ok",
      evidence: {
        files: { "README.md": "See [section](docs/arch.md#overview)." },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "README.md", bytes: 100, lines: 1, depth: 0 },
            { path: "docs/arch.md", bytes: 100, lines: 1, depth: 1 },
          ],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "directory-link-ok",
      evidence: {
        files: { "README.md": "See the [docs/](docs/) folder." },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "README.md", bytes: 100, lines: 1, depth: 0 },
            { path: "docs/arch.md", bytes: 100, lines: 1, depth: 1 },
          ],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "many-broken-from-claude",
      evidence: {
        files: {
          "CLAUDE.md":
            "Setup: [getting-started](docs/getting-started.md). Arch: [arch](docs/arch.md). Specs: [spec1](specs/spec1.md).",
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "CLAUDE.md", bytes: 100, lines: 1, depth: 0 }],
        },
      },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "CLAUDE.md", range: { startLine: 1 } },
              severity: "warn",
              message: "broken link → docs/getting-started.md",
            },
            {
              location: { path: "CLAUDE.md", range: { startLine: 1 } },
              severity: "warn",
              message: "broken link → docs/arch.md",
            },
            {
              location: { path: "CLAUDE.md", range: { startLine: 1 } },
              severity: "warn",
              message: "broken link → specs/spec1.md",
            },
          ],
        },
        score: 60,
      },
    },
  ],
});
