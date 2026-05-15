import { defineProbe } from "@esbenwiberg/repofit/sdk";

const BUILD_COMMAND_HINTS = [
  /\bnpm\s+(?:run\s+)?build\b/,
  /\byarn\s+build\b/,
  /\bpnpm\s+(?:run\s+)?build\b/,
  /\bgo\s+build\b/,
  /\bcargo\s+build\b/,
  /\bdotnet\s+build\b/,
  /\bmvn\s+(?:compile|package|verify|install)\b/,
  /\bgradle\s+(?:build|assemble)\b/,
  /\bpython\s+-m\s+build\b/,
  /\bvite\s+build\b/,
  /\btsup\b/,
  /\bturbo\s+(?:run\s+)?build\b/,
  /\bnx\s+(?:run-many\s+)?(?:--target=)?build\b/,
];

export default defineProbe({
  id: "ci.runs-build",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "derived",
  evidence: ["ci_workflows"],

  rationale: `
    Build only counts as a feedback loop if CI runs it on every push.
    Local builds drift — a project that builds on the maintainer's
    machine but not on a clean checkout is one a fresh agent (or
    contributor) can't onboard to. This probe looks for a recognisable
    build command inside any GitHub Actions workflow. Non-GitHub CI is
    out of scope until we add adapters.
  `,

  remediation:
    "Add a build step to your CI workflow. GitHub Actions: a `run: npm run build` (or `go build ./...`, `cargo build --release`, `dotnet build`, `mvn package`, `gradle build`) step in `.github/workflows/ci.yml`. Pair with `build.configured` — a build that's defined but never run on CI will silently rot.",

  async detect(ev) {
    if (!ev.ci_workflows.present) {
      return { kind: "predicate", value: false };
    }
    for (const wf of ev.ci_workflows.workflows) {
      if (BUILD_COMMAND_HINTS.some((p) => p.test(wf.raw))) {
        return { kind: "predicate", value: true };
      }
    }
    return { kind: "predicate", value: false };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-workflows",
      evidence: { ci_workflows: { present: false, workflows: [] } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "workflow-runs-npm-build",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: npm run build" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-runs-cargo-build",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: cargo build --release" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-runs-dotnet-build",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: dotnet build" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-no-build",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/lint.yml", raw: "run: npm run lint" }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
