import { defineProbe } from "@esbenwiberg/repofit/sdk";

const DIRECT_HOOK_PATHS = [
  ".husky/pre-commit",
  ".githooks/pre-commit",
  ".git/hooks/pre-commit",
  ".pre-commit-config.yaml",
  ".pre-commit-config.yml",
];

const CONFIG_HOOK_PATHS = [
  "lefthook.yml",
  "lefthook.yaml",
  ".lefthook.yml",
  ".lefthook.yaml",
  ".lefthook/pre-commit.yml",
  ".lefthook/pre-commit.yaml",
  ".overcommit.yml",
];

export default defineProbe({
  id: "hooks.precommit-present",
  version: "1.1.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["files", "node_package"],

  rationale: `
    A pre-commit hook is local feedback an agent can actually feel: if the
    commit it just made fails the hook, the failure is immediate and
    actionable. Without one, mistakes survive until CI (slower loop) or
    code review (much slower).
  `,

  remediation:
    "Wire a pre-commit hook. Easiest options: `husky` or `simple-git-hooks` (Node), `pre-commit` (Python — `.pre-commit-config.yaml`), `lefthook`, `overcommit`, or commit hooks under `.githooks/` + `git config core.hooksPath .githooks`. Run lint/format/test from it.",

  async detect(ev) {
    return {
      kind: "predicate",
      value:
        DIRECT_HOOK_PATHS.some((p) => ev.files.has(p)) ||
        (await hasPreCommitManagerConfig(ev.files)) ||
        hasPackageJsonPreCommitConfig(ev.node_package.raw),
    };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "husky-hook",
      evidence: { files: [".husky/pre-commit"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "githooks-hook",
      evidence: { files: [".githooks/pre-commit"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "pre-commit-framework",
      evidence: { files: [".pre-commit-config.yaml"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "pre-commit-framework-yml",
      evidence: { files: [".pre-commit-config.yml"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "lefthook-config",
      evidence: {
        files: { "lefthook.yml": "pre-commit:\n  commands:\n    lint:\n      run: npm run lint\n" },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "simple-git-hooks-package-config",
      evidence: {
        node_package: {
          present: true,
          dependencies: {},
          devDependencies: { "simple-git-hooks": "^2.13.1" },
          scripts: {},
          raw: { "simple-git-hooks": { "pre-commit": "npm test" } },
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "no-hooks",
      evidence: { files: [] },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});

async function hasPreCommitManagerConfig(files: {
  has(path: string): boolean;
  readText(path: string): Promise<string | undefined>;
}): Promise<boolean> {
  for (const path of CONFIG_HOOK_PATHS) {
    if (!files.has(path)) continue;
    if (path.includes("/pre-commit.")) return true;
    const content = await files.readText(path);
    if (content === undefined) return true;
    if (/^pre-commit\s*:/m.test(content)) return true;
  }
  return false;
}

function hasPackageJsonPreCommitConfig(raw: Record<string, unknown> | null): boolean {
  if (!raw) return false;
  const husky = asRecord(raw.husky);
  const huskyHooks = asRecord(husky?.hooks);
  if (typeof huskyHooks?.["pre-commit"] === "string") return true;

  const simpleGitHooks = asRecord(raw["simple-git-hooks"]);
  if (typeof simpleGitHooks?.["pre-commit"] === "string") return true;

  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
