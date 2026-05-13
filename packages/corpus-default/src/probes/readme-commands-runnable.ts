import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CODE_FENCE_RE = /```(?:sh|bash|shell|zsh|console|bashrc)?\s*\n([\s\S]*?)```/g;
const CMD_LINE_RE = /^[ \t]*\$?[ \t]*(npm|pnpm|yarn|bun)[ \t]+(\S+)(?:[ \t]+(\S+))?/gm;

const PACKAGE_MANAGER_BUILTINS = new Set([
  "install",
  "i",
  "add",
  "ci",
  "remove",
  "uninstall",
  "rm",
  "un",
  "audit",
  "init",
  "create",
  "publish",
  "version",
  "update",
  "up",
  "upgrade",
  "outdated",
  "exec",
  "x",
  "dlx",
  "help",
  "ls",
  "list",
  "fund",
  "link",
  "unlink",
  "dedupe",
  "prune",
  "rebuild",
  "cache",
  "config",
  "doctor",
  "fix",
  "info",
  "view",
  "search",
  "login",
  "logout",
  "whoami",
  "team",
  "owner",
  "deprecate",
  "pack",
  "tag",
  "import",
]);

type CmdRef = { line: number; raw: string; script: string; runnable: boolean };

export default defineProbe({
  id: "readme.commands-runnable",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["files", "node_package"],

  rationale: `
    The README is the first thing an agent reads when it lands. If the
    commands it lists ('npm run dev', 'npm test', 'pnpm build') don't
    exist as scripts in package.json, the agent will copy them and
    immediately fail. This probe extracts package-manager invocations
    from fenced code blocks in README.md and checks each against the
    actual script list. Package-manager builtins (install, ci, test,
    audit, etc.) always count as runnable; 'npm run X' and 'npm X' must
    resolve to a real script.
  `,

  remediation:
    'For each broken reference, either add the script to package.json (e.g., `"dev": "vite"`) or update the README to use a command that actually works. Keep code blocks copy-pasteable — if the agent has to interpret \'replace X with your-script\', it will guess wrong.',

  async detect(ev) {
    if (!ev.node_package.present) {
      return { kind: "na", reason: "no package.json (this probe is npm-script aware only)" };
    }
    const readme = await ev.files.readText("README.md");
    if (!readme) {
      return { kind: "na", reason: "no README.md" };
    }

    const refs = extractRefs(readme);
    if (refs.length === 0) {
      return { kind: "na", reason: "no package-manager commands referenced in README" };
    }

    const scripts = ev.node_package.scripts;
    let runnable = 0;
    for (const ref of refs) {
      ref.runnable = isRunnable(ref.script, scripts);
      if (ref.runnable) runnable += 1;
    }
    const pct = Math.round((runnable / refs.length) * 100);
    return { kind: "magnitude", value: pct, unit: "%" };
  },

  score: {
    kind: "magnitude",
    direction: "positive",
    bands: [
      { upTo: 49, score: 20 },
      { upTo: 79, score: 50 },
      { upTo: 99, score: 80 },
      { score: 100 },
    ],
  },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false }, files: [] },
      expect: {
        reading: { kind: "na", reason: "no package.json (this probe is npm-script aware only)" },
        score: null,
      },
    },
    {
      name: "no-readme",
      evidence: { node_package: { present: true }, files: [] },
      expect: { reading: { kind: "na", reason: "no README.md" }, score: null },
    },
    {
      name: "readme-with-no-commands",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc" } },
        files: { "README.md": "# Hello\n\nThis is a project.\n" },
      },
      expect: {
        reading: { kind: "na", reason: "no package-manager commands referenced in README" },
        score: null,
      },
    },
    {
      name: "all-commands-runnable",
      evidence: {
        node_package: {
          present: true,
          scripts: { build: "tsc", test: "vitest", dev: "vite" },
        },
        files: {
          "README.md":
            "# X\n\n## Build\n\n```sh\nnpm install\nnpm run build\nnpm test\nnpm run dev\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "one-broken-command",
      evidence: {
        node_package: {
          present: true,
          scripts: { build: "tsc", test: "vitest" },
        },
        files: {
          "README.md": "# X\n\n```bash\nnpm install\nnpm run build\nnpm run start\nnpm test\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 75, unit: "%" }, score: 50 },
    },
    {
      name: "mostly-broken",
      evidence: {
        node_package: { present: true, scripts: { test: "vitest" } },
        files: {
          "README.md": "# X\n\n```\nnpm run dev\nnpm run build\nnpm run lint\nnpm test\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 25, unit: "%" }, score: 20 },
    },
    {
      name: "pnpm-and-yarn-mix",
      evidence: {
        node_package: {
          present: true,
          scripts: { build: "tsc", test: "vitest" },
        },
        files: {
          "README.md": "# X\n\n```sh\npnpm install\npnpm build\nyarn test\nbun run build\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
  ],
});

function extractRefs(readme: string): CmdRef[] {
  const refs: CmdRef[] = [];
  CODE_FENCE_RE.lastIndex = 0;
  for (const fence of readme.matchAll(CODE_FENCE_RE)) {
    const block = fence[1] ?? "";
    const blockStart = (fence.index ?? 0) + (fence[0]?.indexOf(block) ?? 0);
    CMD_LINE_RE.lastIndex = 0;
    for (const m of block.matchAll(CMD_LINE_RE)) {
      const verb = m[2];
      const next = m[3];
      if (!verb) continue;
      const script = verb === "run" ? (next ?? "") : verb;
      if (script.length === 0) continue;
      const offset = (m.index ?? 0) + blockStart;
      const line = (readme.slice(0, offset).match(/\n/g)?.length ?? 0) + 1;
      refs.push({
        line,
        raw: m[0],
        script,
        runnable: false,
      });
    }
  }
  return refs;
}

function isRunnable(name: string, scripts: Record<string, string>): boolean {
  if (PACKAGE_MANAGER_BUILTINS.has(name)) return true;
  return name in scripts;
}
