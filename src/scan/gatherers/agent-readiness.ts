import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";
import { execCmd } from "../exec.js";

interface AgentConfig {
  tool: string;
  paths: string[];
}

interface AgentDoc {
  kind: string;
  path: string;
  bytes: number;
  lastTouchedDaysAgo?: number;
  lastTouchedISO?: string;
}

interface AdrSummary {
  path: string;
  number: string | null;
  title: string;
  status: string | null;
  modifiedISO: string;
  ageDays: number;
}

interface SpecsSummary {
  hasSpecsDir: boolean;
  hasTemplate: boolean;
  hasReadme: boolean;
  specs: Array<{ slug: string; files: string[] }>;
}

interface AgentReadinessReport {
  configs: AgentConfig[];
  docs: AgentDoc[];
  nestedContextFiles: NestedContextFile[];
  adrs: AdrSummary[];
  specs: SpecsSummary;
  agentryLockfilePresent: boolean;
  agentryOverlaysFilePresent: boolean;
  staleSignals: Array<{
    kind: string;
    path: string;
    reason: string;
  }>;
}

interface NestedContextFile {
  kind: "claude-md" | "agents-md";
  path: string;
  bytes: number;
  depth: number;
  lastTouchedDaysAgo?: number;
  lastTouchedISO?: string;
}

const AGENT_CONFIG_LOCATIONS: Array<{ tool: string; paths: string[] }> = [
  { tool: "claude-code", paths: [".claude", ".claude.json"] },
  { tool: "claude-md", paths: ["CLAUDE.md"] },
  { tool: "agents-md", paths: ["AGENTS.md"] },
  { tool: "cursor", paths: [".cursor", ".cursorrules"] },
  { tool: "github-copilot", paths: [".github/copilot-instructions.md"] },
  { tool: "aider", paths: [".aider.conf.yml", ".aider.conf.yaml", ".aider.conf"] },
  { tool: "continue", paths: [".continue", ".continue.json"] },
  { tool: "codex", paths: [".codex"] },
  { tool: "windsurf", paths: [".windsurf"] },
  { tool: "agent-toml", paths: [".agent.toml"] },
];

const AGENT_DOC_LOCATIONS: Array<{ kind: string; paths: string[] }> = [
  { kind: "claude-md", paths: ["CLAUDE.md"] },
  { kind: "agents-md", paths: ["AGENTS.md"] },
  { kind: "practices", paths: ["PRACTICES.md", "CONVENTIONS.md", "STYLEGUIDE.md", "STYLE_GUIDE.md"] },
  { kind: "architecture", paths: ["ARCHITECTURE.md", "docs/architecture.md", "docs/ARCHITECTURE.md"] },
  { kind: "onboarding", paths: ["ONBOARDING.md", "docs/getting-started.md", "docs/GETTING_STARTED.md"] },
  { kind: "contributing", paths: ["CONTRIBUTING.md"] },
];

const ADR_DIRS = [
  "docs/adr",
  "docs/decisions",
  "architecture/decisions",
  "doc/adr",
];

const NESTED_CONTEXT_FILENAMES: Record<string, "claude-md" | "agents-md"> = {
  "CLAUDE.md": "claude-md",
  "AGENTS.md": "agents-md",
};

const NESTED_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  "target",
  "vendor",
  ".gradle",
  "coverage",
  ".nyc_output",
  ".turbo",
  ".parcel-cache",
  ".agentry",
  ".idea",
  ".vscode",
]);

const MAX_NESTED_DEPTH = 6;
// Codex documents a 32 KiB hard cap on AGENTS.md (project_doc_max_bytes
// default). Beyond that, content is silently dropped. Use the same threshold
// to flag CLAUDE.md / AGENTS.md context-rot risk across tools.
const CONTEXT_ROT_BYTES = 32_768;

async function detectConfigs(cwd: string): Promise<AgentConfig[]> {
  const out: AgentConfig[] = [];
  for (const loc of AGENT_CONFIG_LOCATIONS) {
    const present = loc.paths.filter((p) => existsSync(resolve(cwd, p)));
    if (present.length > 0) out.push({ tool: loc.tool, paths: present });
  }
  return out;
}

async function getLastTouchedDays(cwd: string, rel: string): Promise<{ days: number; iso: string } | null> {
  const r = await execCmd("git", ["log", "-1", "--format=%aI", "--", rel], {
    cwd,
    timeoutMs: 5_000,
  });
  if (r.exitCode !== 0 || !r.stdout.trim()) return null;
  const iso = r.stdout.trim();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  return { days, iso };
}

async function detectDocs(
  cwd: string,
  hasGit: boolean,
): Promise<AgentDoc[]> {
  const out: AgentDoc[] = [];
  for (const loc of AGENT_DOC_LOCATIONS) {
    for (const p of loc.paths) {
      const full = resolve(cwd, p);
      if (!existsSync(full)) continue;
      let bytes = 0;
      try {
        bytes = statSync(full).size;
      } catch {
        /* ignore */
      }
      const doc: AgentDoc = { kind: loc.kind, path: p, bytes };
      if (hasGit) {
        const t = await getLastTouchedDays(cwd, p);
        if (t) {
          doc.lastTouchedDaysAgo = t.days;
          doc.lastTouchedISO = t.iso;
        }
      }
      out.push(doc);
    }
  }
  return out;
}

async function findNestedContextFiles(
  cwd: string,
  hasGit: boolean,
): Promise<NestedContextFile[]> {
  const out: NestedContextFile[] = [];

  async function walk(rel: string, depth: number): Promise<void> {
    if (depth > MAX_NESTED_DEPTH) return;
    let entries;
    try {
      entries = readdirSync(resolve(cwd, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const childRel = rel === "" ? ent.name : `${rel}/${ent.name}`;
      if (ent.isDirectory()) {
        if (NESTED_IGNORE_DIRS.has(ent.name)) continue;
        // Skip hidden dirs except `.github` (which can hold AGENTS.md).
        if (ent.name.startsWith(".") && ent.name !== ".github") continue;
        await walk(childRel, depth + 1);
        continue;
      }
      if (!ent.isFile()) continue;
      const kind = NESTED_CONTEXT_FILENAMES[ent.name];
      if (!kind) continue;
      // Root-level CLAUDE.md / AGENTS.md are already in `docs[]`.
      if (depth === 0) continue;
      let bytes = 0;
      try {
        bytes = statSync(resolve(cwd, childRel)).size;
      } catch {
        continue;
      }
      const file: NestedContextFile = {
        kind,
        path: childRel,
        bytes,
        depth,
      };
      if (hasGit) {
        const t = await getLastTouchedDays(cwd, childRel);
        if (t) {
          file.lastTouchedDaysAgo = t.days;
          file.lastTouchedISO = t.iso;
        }
      }
      out.push(file);
    }
  }

  await walk("", 0);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

async function detectAdrs(cwd: string, hasGit: boolean): Promise<AdrSummary[]> {
  const out: AdrSummary[] = [];
  for (const adrDir of ADR_DIRS) {
    const dir = resolve(cwd, adrDir);
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (!f.endsWith(".md")) continue;
      if (f.toLowerCase() === "readme.md" || f.toLowerCase() === "template.md") continue;
      const rel = `${adrDir}/${f}`;
      const full = resolve(cwd, rel);
      let txt = "";
      try {
        txt = await readFile(full, "utf8");
      } catch {
        continue;
      }
      const numMatch = f.match(/^(\d+)/);
      const number = numMatch ? numMatch[1]! : null;
      const titleMatch = txt.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1]!.trim() : f;
      const statusMatch = txt.match(/\*\*Status:\*\*\s*(.+)$/m);
      const status = statusMatch ? statusMatch[1]!.trim() : null;
      let modifiedISO = "";
      let ageDays = 0;
      if (hasGit) {
        const t = await getLastTouchedDays(cwd, rel);
        if (t) {
          modifiedISO = t.iso;
          ageDays = t.days;
        }
      }
      if (!modifiedISO) {
        try {
          const s = statSync(full);
          modifiedISO = new Date(s.mtimeMs).toISOString();
          ageDays = Math.round((Date.now() - s.mtimeMs) / 86_400_000);
        } catch {
          /* ignore */
        }
      }
      out.push({ path: rel, number, title, status, modifiedISO, ageDays });
    }
  }
  return out;
}

function detectSpecs(cwd: string): SpecsSummary {
  const dir = resolve(cwd, "specs");
  if (!existsSync(dir)) {
    return { hasSpecsDir: false, hasTemplate: false, hasReadme: false, specs: [] };
  }
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return { hasSpecsDir: true, hasTemplate: false, hasReadme: false, specs: [] };
  }
  const hasReadme = entries.includes("README.md");
  const hasTemplate = entries.includes("_template");
  const specs: Array<{ slug: string; files: string[] }> = [];
  for (const e of entries) {
    if (e === "README.md" || e === "_template" || e.startsWith(".")) continue;
    const sub = resolve(dir, e);
    let isDir = false;
    try {
      isDir = statSync(sub).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    let files: string[] = [];
    try {
      files = readdirSync(sub).filter((f) => !f.startsWith("."));
    } catch {
      /* ignore */
    }
    specs.push({ slug: e, files });
  }
  return { hasSpecsDir: true, hasTemplate, hasReadme, specs };
}

function findStaleSignals(
  docs: AgentDoc[],
  nested: NestedContextFile[],
  adrs: AdrSummary[],
): Array<{ kind: string; path: string; reason: string }> {
  const out: Array<{ kind: string; path: string; reason: string }> = [];
  const STALE_DAYS = 365;
  for (const d of docs) {
    if (d.lastTouchedDaysAgo !== undefined && d.lastTouchedDaysAgo > STALE_DAYS) {
      out.push({
        kind: d.kind,
        path: d.path,
        reason: `not touched in ${d.lastTouchedDaysAgo} days`,
      });
    }
    if (
      (d.kind === "claude-md" || d.kind === "agents-md") &&
      d.bytes >= CONTEXT_ROT_BYTES
    ) {
      out.push({
        kind: d.kind,
        path: d.path,
        reason: `context-rot risk — ${d.bytes} bytes (≥ ${CONTEXT_ROT_BYTES}); consider splitting into nested context files`,
      });
    }
  }
  for (const f of nested) {
    if (f.lastTouchedDaysAgo !== undefined && f.lastTouchedDaysAgo > STALE_DAYS) {
      out.push({
        kind: f.kind,
        path: f.path,
        reason: `nested context not touched in ${f.lastTouchedDaysAgo} days`,
      });
    }
    if (f.bytes >= CONTEXT_ROT_BYTES) {
      out.push({
        kind: f.kind,
        path: f.path,
        reason: `context-rot risk — ${f.bytes} bytes (≥ ${CONTEXT_ROT_BYTES}); consider splitting deeper`,
      });
    }
  }
  for (const a of adrs) {
    if (a.ageDays > STALE_DAYS && a.status && /accepted/i.test(a.status)) {
      out.push({
        kind: "adr",
        path: a.path,
        reason: `Accepted ADR not touched in ${a.ageDays} days`,
      });
    }
  }
  return out;
}

export const agentReadinessGatherer: Gatherer = {
  name: "agent-readiness",
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "agent-readiness");
    await mkdir(dir, { recursive: true });

    const hasGit =
      existsSync(resolve(ctx.cwd, ".git")) &&
      ctx.toolAvailability.git === true;

    const configs = await detectConfigs(ctx.cwd);
    const docs = await detectDocs(ctx.cwd, hasGit);
    const nestedContextFiles = await findNestedContextFiles(ctx.cwd, hasGit);
    const adrs = await detectAdrs(ctx.cwd, hasGit);
    const specs = detectSpecs(ctx.cwd);
    const stale = findStaleSignals(docs, nestedContextFiles, adrs);

    const report: AgentReadinessReport = {
      configs,
      docs,
      nestedContextFiles,
      adrs,
      specs,
      agentryLockfilePresent: existsSync(resolve(ctx.cwd, "agentry.lock.toml")),
      agentryOverlaysFilePresent: existsSync(
        resolve(ctx.cwd, "agentry.overlays.toml"),
      ),
      staleSignals: stale,
    };

    await writeFile(
      join(dir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    return ["agent-readiness/report.json"];
  },
};
