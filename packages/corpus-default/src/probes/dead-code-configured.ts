import { defineProbe } from "@esbenwiberg/repofit/sdk";

const NODE_DEAD_CODE_TOOLS = ["knip", "ts-prune", "depcheck", "unimported", "madge"];

const NODE_CONFIG_FILES = [
  "knip.json",
  "knip.jsonc",
  "knip.config.js",
  "knip.config.ts",
  ".knip.json",
  ".depcheckrc",
  ".depcheckrc.json",
  ".depcheckrc.yaml",
  ".depcheckrc.yml",
  ".unimportedrc.json",
];

const NODE_SCRIPT_HINTS = [
  /\bknip\b/,
  /\bts-prune\b/,
  /\bdepcheck\b/,
  /\bunimported\b/,
  /\bmadge\b/,
];

const PY_DEAD_CODE_HINTS = [/\bvulture\b/i, /\bdeptry\b/i, /\bunimport\b/i];

const RUST_DEAD_CODE_HINTS = [/\bcargo[-\s]machete\b/i, /\bcargo[-\s]udeps\b/i];

const GO_DEAD_CODE_HINTS = [
  /linters-settings:[\s\S]*\b(?:unused|deadcode|unparam)\b/i,
  /\bstaticcheck\b/i,
  /\bdeadcode\s+/i,
];

const DOTNET_DEAD_CODE_HINTS = [
  /\broslynator\b/i,
  /\bjb\s+inspectcode\b/i,
  /\bIDE005[12]\b/,
];

export default defineProbe({
  id: "dead.code-configured",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["node_package", "files", "size_stats", "ci_workflows"],

  rationale: `
    Dead code (unused exports, unreferenced files, abandoned dependencies)
    inflates the surface area an agent has to skim before it can act, and
    misleads it about which functions are load-bearing. A configured
    dead-code detector keeps that drift under control. This probe looks
    for the canonical tools per ecosystem: knip / ts-prune / depcheck /
    unimported (Node), vulture / deptry (Python), cargo-machete /
    cargo-udeps (Rust), staticcheck or golangci-lint with the unused
    family enabled (Go), Roslynator or the IDE0051/IDE0052 analyzers
    (.NET). Detected via devDeps + config/script, or via a CI workflow
    invocation.
  `,

  remediation:
    "Add a dead-code detector. Node/TS: `npm i -D knip` then `npx knip` (or `ts-prune`, `depcheck`). Python: `pip install vulture` and add `vulture src/` to CI, or `deptry .` for unused dependencies. Rust: `cargo install cargo-machete` for unused deps. Go: enable `unused`, `deadcode`, `unparam` in `.golangci.yml`. .NET: enable Roslynator or the built-in IDE0051/IDE0052 analyzers in `.editorconfig`. Wire whatever you pick into CI so dead code can't accumulate silently.",

  async detect(ev) {
    if (ev.node_package.present) {
      const deps = {
        ...ev.node_package.dependencies,
        ...ev.node_package.devDependencies,
      };
      const hasDep = NODE_DEAD_CODE_TOOLS.some((name) => name in deps);
      const scriptsBlob = Object.values(ev.node_package.scripts).join("\n");
      const hasScript = NODE_SCRIPT_HINTS.some((p) => p.test(scriptsBlob));
      const hasConfig = NODE_CONFIG_FILES.some((path) => ev.files.has(path));
      if (hasDep && (hasScript || hasConfig)) return { kind: "predicate", value: true };
      if (hasScript) return { kind: "predicate", value: true };
    }

    const allPaths = ev.size_stats.files.map((f) => f.path);
    const hasPy = allPaths.some((p) => /(?:^|\/)(?:pyproject\.toml|setup\.cfg|setup\.py|Pipfile|requirements(?:[-.][\w]+)?\.txt)$/i.test(p));
    const hasGo = allPaths.some((p) => /(?:^|\/)go\.mod$/i.test(p));
    const hasRust = allPaths.some((p) => /(?:^|\/)Cargo\.toml$/i.test(p));
    const hasDotnet = allPaths.some((p) => /\.(?:cs|fs|vb)proj$/i.test(p));

    const ciBlob = ev.ci_workflows.workflows.map((w) => w.raw).join("\n");

    if (hasPy && PY_DEAD_CODE_HINTS.some((p) => p.test(ciBlob))) {
      return { kind: "predicate", value: true };
    }
    if (hasRust && RUST_DEAD_CODE_HINTS.some((p) => p.test(ciBlob))) {
      return { kind: "predicate", value: true };
    }
    if (hasGo) {
      const golangciRaw = (await ev.files.readText(".golangci.yml")) ?? (await ev.files.readText(".golangci.yaml")) ?? "";
      if (GO_DEAD_CODE_HINTS.some((p) => p.test(`${ciBlob}\n${golangciRaw}`))) {
        return { kind: "predicate", value: true };
      }
    }
    if (hasDotnet) {
      const editorconfig = (await ev.files.readText(".editorconfig")) ?? "";
      if (DOTNET_DEAD_CODE_HINTS.some((p) => p.test(`${ciBlob}\n${editorconfig}`))) {
        return { kind: "predicate", value: true };
      }
    }

    if (!ev.node_package.present && !hasPy && !hasGo && !hasRust && !hasDotnet) {
      return { kind: "na", reason: "no recognised project manifest" };
    }

    return { kind: "predicate", value: false };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-manifest",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "na", reason: "no recognised project manifest" }, score: null },
    },
    {
      name: "node-knip-dep-plus-script",
      evidence: {
        node_package: {
          present: true,
          devDependencies: { knip: "^5.0.0" },
          scripts: { knip: "knip" },
        },
        files: [],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-knip-dep-but-no-wiring",
      evidence: {
        node_package: {
          present: true,
          devDependencies: { knip: "^5.0.0" },
        },
        files: [],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "node-knip-dep-plus-config",
      evidence: {
        node_package: {
          present: true,
          devDependencies: { knip: "^5.0.0" },
        },
        files: ["knip.json"],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "python-vulture-in-ci",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "pyproject.toml", bytes: 50, lines: 3, depth: 0 }],
        },
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: vulture src/" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "rust-cargo-machete",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "Cargo.toml", bytes: 50, lines: 3, depth: 0 }],
        },
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: cargo machete" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "go-without-deadcode-linter",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "go.mod", bytes: 50, lines: 3, depth: 0 }],
        },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "dotnet-with-roslynator",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "src/App.csproj", bytes: 50, lines: 3, depth: 1 }],
        },
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: roslynator analyze" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
  ],
});
