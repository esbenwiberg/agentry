import { defineProbe } from "@esbenwiberg/repofit/sdk";

const NODE_LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
];

const PY_MANIFEST = /(?:^|\/)(?:pyproject\.toml|setup\.cfg|setup\.py|Pipfile)$/i;
const PY_LOCKFILES = /(?:^|\/)(?:poetry\.lock|Pipfile\.lock|uv\.lock|pdm\.lock)$/i;

const GO_MOD = /(?:^|\/)go\.mod$/i;
const GO_SUM = /(?:^|\/)go\.sum$/i;

const RUST_MANIFEST = /(?:^|\/)Cargo\.toml$/i;
const RUST_LOCKFILE = /(?:^|\/)Cargo\.lock$/i;

const RUBY_GEMFILE = /(?:^|\/)Gemfile$/;
const RUBY_LOCKFILE = /(?:^|\/)Gemfile\.lock$/;

const DOTNET_PROJECT = /\.(?:cs|fs|vb)proj$/i;
const DOTNET_LOCKFILE = /(?:^|\/)packages\.lock\.json$/i;

export default defineProbe({
  id: "deps.lockfile-present",
  version: "1.0.0",
  dimensions: [{ id: "safety", weight: 1 }],
  tier: "static",
  evidence: ["node_package", "files", "size_stats"],

  rationale: `
    A lockfile pins the exact dependency graph an agent (or anyone else)
    will install. Without one, two installs minutes apart can produce
    different trees, and the agent's "works on my machine" may not be
    reproducible. This probe checks for a lockfile alongside a recognised
    manifest across Node, Python (poetry/pipenv/uv/pdm), Go (\`go.sum\`),
    Rust (\`Cargo.lock\`), Ruby (\`Gemfile.lock\`), and .NET
    (\`packages.lock.json\`). Maven has no native lockfile concept and is
    ignored.
  `,

  remediation:
    "Commit a lockfile. Node: run `npm install` / `yarn` / `pnpm install` / `bun install` and check in the resulting lockfile. Python: use Poetry, Pipenv, uv, or pdm and commit their lockfile. Go: `go mod tidy` then commit `go.sum`. Rust: commit `Cargo.lock` (binaries — for libraries it's optional but harmless). Ruby: commit `Gemfile.lock`. .NET: set `<RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>` in the project and commit `packages.lock.json`.",

  async detect(ev) {
    const allPaths = ev.size_stats.files.map((f) => f.path);
    const hasFile = (re: RegExp) => allPaths.some((p) => re.test(p));

    const ecosystems: { name: string; manifest: boolean; lockfile: boolean }[] = [];

    if (ev.node_package.present) {
      const hasNodeLock = NODE_LOCKFILES.some((name) => ev.files.has(name));
      ecosystems.push({ name: "node", manifest: true, lockfile: hasNodeLock });
    }

    if (hasFile(PY_MANIFEST)) {
      ecosystems.push({ name: "python", manifest: true, lockfile: hasFile(PY_LOCKFILES) });
    }

    if (hasFile(GO_MOD)) {
      ecosystems.push({ name: "go", manifest: true, lockfile: hasFile(GO_SUM) });
    }

    if (hasFile(RUST_MANIFEST)) {
      ecosystems.push({ name: "rust", manifest: true, lockfile: hasFile(RUST_LOCKFILE) });
    }

    if (hasFile(RUBY_GEMFILE)) {
      ecosystems.push({ name: "ruby", manifest: true, lockfile: hasFile(RUBY_LOCKFILE) });
    }

    if (hasFile(DOTNET_PROJECT)) {
      ecosystems.push({ name: "dotnet", manifest: true, lockfile: hasFile(DOTNET_LOCKFILE) });
    }

    if (ecosystems.length === 0) {
      return { kind: "na", reason: "no recognised dependency manifest" };
    }

    const allLocked = ecosystems.every((e) => e.lockfile);
    return { kind: "predicate", value: allLocked };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-manifest",
      evidence: {
        node_package: { present: false },
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
        files: [],
      },
      expect: { reading: { kind: "na", reason: "no recognised dependency manifest" }, score: null },
    },
    {
      name: "node-with-lockfile",
      evidence: {
        node_package: { present: true },
        files: ["package-lock.json"],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-no-lockfile",
      evidence: {
        node_package: { present: true },
        files: [],
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "go-with-sum",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "go.mod", bytes: 100, lines: 5, depth: 0 },
            { path: "go.sum", bytes: 100, lines: 5, depth: 0 },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "rust-no-cargo-lock",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "Cargo.toml", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "dotnet-with-packages-lock",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "src/App.csproj", bytes: 100, lines: 5, depth: 1 },
            { path: "src/packages.lock.json", bytes: 100, lines: 5, depth: 1 },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "python-pipfile-no-lock",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "Pipfile", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "ruby-with-gemfile-lock",
      evidence: {
        node_package: { present: false },
        files: [],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "Gemfile", bytes: 100, lines: 5, depth: 0 },
            { path: "Gemfile.lock", bytes: 100, lines: 5, depth: 0 },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-locked-but-go-unlocked",
      evidence: {
        node_package: { present: true },
        files: ["package-lock.json"],
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "go.mod", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
