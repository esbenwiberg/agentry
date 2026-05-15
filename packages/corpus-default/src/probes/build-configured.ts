import { defineProbe } from "@esbenwiberg/repofit/sdk";

const GO_MOD = /(?:^|\/)go\.mod$/i;
const RUST_MANIFEST = /(?:^|\/)Cargo\.toml$/i;
const JAVA_BUILD = /(?:^|\/)(?:pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/i;
const DOTNET_PROJECT = /\.(?:csproj|fsproj|vbproj|sln)$/i;
const PY_PYPROJECT = /(?:^|\/)pyproject\.toml$/i;

const PY_BUILD_SYSTEM = /^\s*\[build-system\]/m;

async function anyMatchInFiles(
  paths: string[],
  patterns: RegExp[],
  readText: (p: string) => Promise<string | undefined>,
): Promise<boolean> {
  for (const p of paths) {
    const text = await readText(p);
    if (!text) continue;
    if (patterns.some((re) => re.test(text))) return true;
  }
  return false;
}

export default defineProbe({
  id: "build.configured",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["node_package", "files", "size_stats"],

  rationale: `
    A configured build is how an agent verifies its diff still
    integrates — typecheck catches type errors but not module resolution,
    bundler config, or output emission. For Node, that's an explicit
    \`build\` script; for compiled languages the toolchain build is
    built in (\`go build\`, \`cargo build\`, \`mvn compile\`,
    \`dotnet build\`, \`python -m build\` for libs). A TypeScript repo
    with no \`build\` script means the agent has no way to confirm the
    project still compiles to ship-shape JS.
  `,

  remediation:
    'Wire a build step. Node: add `"build"` to `package.json` scripts (e.g., `"build": "tsc"`, `"build": "vite build"`, `"build": "tsup"`). Go: ensure `go.mod` exists — `go build ./...` works out of the box. Rust: `cargo build` ships with Cargo.toml. Java: a `pom.xml` or `build.gradle`. .NET: a `.csproj` or `.sln`. Python libraries: declare `[build-system]` in `pyproject.toml`.',

  async detect(ev) {
    if (ev.node_package.present) {
      const buildScript = ev.node_package.scripts.build;
      if (typeof buildScript === "string" && buildScript.trim().length > 0) {
        return { kind: "predicate", value: true };
      }
    }

    const allPaths = ev.size_stats.files.map((f) => f.path);

    if (allPaths.some((p) => GO_MOD.test(p))) return { kind: "predicate", value: true };
    if (allPaths.some((p) => RUST_MANIFEST.test(p))) return { kind: "predicate", value: true };
    if (allPaths.some((p) => JAVA_BUILD.test(p))) return { kind: "predicate", value: true };
    if (allPaths.some((p) => DOTNET_PROJECT.test(p))) return { kind: "predicate", value: true };

    const pyProjects = allPaths.filter((p) => PY_PYPROJECT.test(p));
    if (
      pyProjects.length > 0 &&
      (await anyMatchInFiles(pyProjects, [PY_BUILD_SYSTEM], ev.files.readText))
    ) {
      return { kind: "predicate", value: true };
    }

    if (
      !ev.node_package.present &&
      pyProjects.length === 0 &&
      !allPaths.some(
        (p) =>
          GO_MOD.test(p) || RUST_MANIFEST.test(p) || JAVA_BUILD.test(p) || DOTNET_PROJECT.test(p),
      )
    ) {
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
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "na", reason: "no recognised project manifest" }, score: null },
    },
    {
      name: "node-build-script",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc" } },
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-no-build-script",
      evidence: {
        node_package: { present: true, scripts: { test: "vitest" } },
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "cargo-toml",
      evidence: {
        node_package: { present: false },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "Cargo.toml", bytes: 50, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "go-mod",
      evidence: {
        node_package: { present: false },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "go.mod", bytes: 50, lines: 3, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "csproj",
      evidence: {
        node_package: { present: false },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 1,
          files: [{ path: "src/App.csproj", bytes: 200, lines: 10, depth: 1 }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "pyproject-with-build-system",
      evidence: {
        files: { "pyproject.toml": "[build-system]\nrequires = ['setuptools']\n" },
        node_package: { present: false },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 50,
          totalFiles: 1,
          files: [{ path: "pyproject.toml", bytes: 50, lines: 2, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "pyproject-no-build-system",
      evidence: {
        files: { "pyproject.toml": "[tool.ruff]\nline-length = 100\n" },
        node_package: { present: false },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 30,
          totalFiles: 1,
          files: [{ path: "pyproject.toml", bytes: 30, lines: 2, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
