import type { NodePackageEvidence, ToolchainEvidence } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CODE_FENCE_RE = /```(?:sh|bash|shell|zsh|console|bashrc)?\s*\n([\s\S]*?)```/g;

const NODE_CMD_RE = /^[ \t]*\$?[ \t]*(npm|pnpm|yarn|bun)[ \t]+(\S+)(?:[ \t]+(\S+))?/gm;
const GENERIC_CMD_RE = /^[ \t]*\$?[ \t]*([A-Za-z][\w-]*)\b/gm;

const NODE_BUILTINS = new Set([
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

// First-word commands that are universally runnable for the matching stack.
// We trust these aren't going to mislead an agent.
const STACK_RUNNABLE_PREFIXES: Record<string, readonly string[]> = {
  python: [
    "python",
    "python3",
    "pytest",
    "ruff",
    "mypy",
    "pyright",
    "black",
    "flake8",
    "pylint",
    "isort",
    "pip",
    "uv",
    "poetry",
    "pdm",
    "hatch",
    "pipenv",
  ],
  dotnet: ["dotnet"],
  go: ["go", "gofmt", "goimports", "golangci-lint", "staticcheck"],
};

type CmdRef = {
  line: number;
  raw: string;
  // First word — `npm`, `pnpm`, `pytest`, `dotnet`, `go`, etc.
  head: string;
  // For npm/pnpm/yarn/bun: the script name (or builtin verb). Empty otherwise.
  script: string;
  runnable: boolean;
};

export default defineProbe({
  id: "readme.commands-runnable",
  version: "2.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["files", "node_package", "toolchain"],

  rationale: `
    The README is the first thing an agent reads when it lands. If the
    commands it lists don't actually work, the agent will copy them and
    immediately fail. This probe extracts package-manager invocations
    (\`npm run X\`, \`pnpm test\`), Python tool calls (\`pytest\`,
    \`ruff check\`), .NET commands (\`dotnet build\`), and Go commands
    (\`go test\`) from fenced code blocks in README.md and checks each
    against the actual scripts / detected toolchain. Package-manager
    builtins and standard SDK commands (\`dotnet build\`,
    \`go test ./...\`) always count as runnable.
  `,

  remediation:
    "For each broken reference, either configure the missing tool/script or update the README to use a command that actually works. Keep code blocks copy-pasteable — if the agent has to interpret 'replace X with your-script', it will guess wrong.",

  async detect(ev) {
    const readme = await ev.files.readText("README.md");
    if (!readme) {
      return { kind: "na", reason: "no README.md" };
    }
    if (!ev.toolchain.primary && !ev.node_package.present) {
      return {
        kind: "na",
        reason: "no supported stack detected — can't tell if README commands are runnable",
      };
    }

    const refs = extractRefs(readme);
    if (refs.length === 0) {
      return { kind: "na", reason: "no commands referenced in README" };
    }

    let runnable = 0;
    for (const ref of refs) {
      ref.runnable = isRunnable(ref, ev.node_package, ev.toolchain);
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
      name: "no-readme",
      evidence: { node_package: { present: true }, files: [] },
      expect: { reading: { kind: "na", reason: "no README.md" }, score: null },
    },
    {
      name: "no-stack",
      evidence: {
        node_package: { present: false },
        toolchain: { primary: null },
        files: { "README.md": "# x\n\n```\nnpm test\n```\n" },
      },
      expect: {
        reading: {
          kind: "na",
          reason: "no supported stack detected — can't tell if README commands are runnable",
        },
        score: null,
      },
    },
    {
      name: "readme-with-no-commands",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc" } },
        toolchain: { stacks: ["node"], primary: "node", commands: {} },
        files: { "README.md": "# Hello\n\nThis is a project.\n" },
      },
      expect: {
        reading: { kind: "na", reason: "no commands referenced in README" },
        score: null,
      },
    },
    {
      name: "node-all-runnable",
      evidence: {
        node_package: {
          present: true,
          scripts: { build: "tsc", test: "vitest", dev: "vite" },
        },
        toolchain: { stacks: ["node"], primary: "node", commands: {} },
        files: {
          "README.md":
            "# X\n\n## Build\n\n```sh\nnpm install\nnpm run build\nnpm test\nnpm run dev\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "node-one-broken",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc", test: "vitest" } },
        toolchain: { stacks: ["node"], primary: "node", commands: {} },
        files: {
          "README.md": "# X\n\n```bash\nnpm install\nnpm run build\nnpm run start\nnpm test\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 75, unit: "%" }, score: 50 },
    },
    {
      name: "python-pytest-runnable",
      evidence: {
        toolchain: { stacks: ["python"], primary: "python", commands: {} },
        files: { "README.md": "# X\n\n```sh\npytest\nruff check .\nmypy .\n```\n" },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "dotnet-all-runnable",
      evidence: {
        toolchain: { stacks: ["dotnet"], primary: "dotnet", commands: {} },
        files: { "README.md": "# X\n\n```sh\ndotnet build\ndotnet test\ndotnet run\n```\n" },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "go-all-runnable",
      evidence: {
        toolchain: { stacks: ["go"], primary: "go", commands: {} },
        files: {
          "README.md": "# X\n\n```sh\ngo build ./...\ngo test ./...\ngolangci-lint run\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "dotnet-only-with-pytest-mention",
      evidence: {
        toolchain: { stacks: ["dotnet"], primary: "dotnet", commands: {} },
        files: { "README.md": "# X\n\n```\ndotnet build\npytest\n```\n" },
      },
      expect: { reading: { kind: "magnitude", value: 50, unit: "%" }, score: 50 },
    },
    {
      name: "unknown-words-ignored",
      evidence: {
        toolchain: { stacks: ["node"], primary: "node", commands: {} },
        node_package: { present: true, scripts: { build: "tsc" } },
        files: {
          "README.md":
            "# X\n\n```\nnpm run build\nsome-fictional-binary --flag\npackages/foo/\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "pnpm-and-yarn-mix",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc", test: "vitest" } },
        toolchain: { stacks: ["node"], primary: "node", commands: {} },
        files: {
          "README.md": "# X\n\n```sh\npnpm install\npnpm build\nyarn test\nbun run build\n```\n",
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
  ],
});

// Tools we'll treat as "candidate commands" worth scoring. Anything else in
// a code fence (directory paths, sample output, fictional binaries like
// `repofit`, prose) is ignored — counted neither as runnable nor broken.
const STACK_TOOLS = new Set<string>([...Object.values(STACK_RUNNABLE_PREFIXES).flat()]);

function extractRefs(readme: string): CmdRef[] {
  const refs: CmdRef[] = [];
  CODE_FENCE_RE.lastIndex = 0;
  for (const fence of readme.matchAll(CODE_FENCE_RE)) {
    const block = fence[1] ?? "";
    const blockStart = (fence.index ?? 0) + (fence[0]?.indexOf(block) ?? 0);

    // First pass: node package-manager commands (we capture the script slot).
    NODE_CMD_RE.lastIndex = 0;
    const nodeHits = new Set<number>();
    for (const m of block.matchAll(NODE_CMD_RE)) {
      const head = m[1];
      const verb = m[2];
      const next = m[3];
      if (!head || !verb) continue;
      const script = verb === "run" ? (next ?? "") : verb;
      if (script.length === 0) continue;
      const offset = (m.index ?? 0) + blockStart;
      const line = (readme.slice(0, offset).match(/\n/g)?.length ?? 0) + 1;
      nodeHits.add(line);
      refs.push({ line, raw: m[0], head, script, runnable: false });
    }

    // Second pass: stack-specific tool invocations (pytest, dotnet, go, …).
    // We ONLY capture known stack tools to avoid false positives on prose,
    // file paths, or fictional command names that happen to start a line.
    GENERIC_CMD_RE.lastIndex = 0;
    for (const m of block.matchAll(GENERIC_CMD_RE)) {
      const head = m[1];
      if (!head) continue;
      if (!STACK_TOOLS.has(head)) continue;
      const offset = (m.index ?? 0) + blockStart;
      const line = (readme.slice(0, offset).match(/\n/g)?.length ?? 0) + 1;
      if (nodeHits.has(line)) continue;
      refs.push({ line, raw: m[0], head, script: "", runnable: false });
    }
  }
  return refs;
}

function isRunnable(ref: CmdRef, node: NodePackageEvidence, toolchain: ToolchainEvidence): boolean {
  // Node package-manager commands
  if (ref.head === "npm" || ref.head === "pnpm" || ref.head === "yarn" || ref.head === "bun") {
    if (NODE_BUILTINS.has(ref.script)) return true;
    if (!node.present) return false;
    return ref.script in node.scripts;
  }
  // Stack-specific tool invocations.
  for (const stack of toolchain.stacks) {
    const prefixes = STACK_RUNNABLE_PREFIXES[stack];
    if (prefixes?.includes(ref.head)) return true;
  }
  return false;
}
