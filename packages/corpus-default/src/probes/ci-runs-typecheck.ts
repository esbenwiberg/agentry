import { defineProbe } from "@esbenwiberg/repofit/sdk";

const TYPECHECK_COMMAND_HINTS = [
  /\bnpm\s+(?:run\s+)?typecheck\b/,
  /\byarn\s+typecheck\b/,
  /\bpnpm\s+(?:run\s+)?typecheck\b/,
  /\btsc\s+--noEmit\b/,
  /\btsc\b\s*$/m,
  /\bmypy\b/,
  /\bpyright\b/,
  /\bpyre\b/,
  /\bcargo\s+check\b/,
  /\bgo\s+build\s+\.\/\.\.\.\b/,
];

export default defineProbe({
  id: "ci.runs-typecheck",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "derived",
  evidence: ["ci_workflows"],

  rationale: `
    A typecheck loop is only worth the bytes it costs when CI enforces
    it. Local typecheck is bypassable; CI is the gate that always
    fires. This probe looks for a recognisable typecheck command inside
    any GitHub Actions workflow (\`tsc --noEmit\`, \`mypy\`, \`pyright\`,
    \`cargo check\`). Non-GitHub CI is out of scope until we add
    adapters.
  `,

  remediation:
    "Add a typecheck step to your CI workflow. GitHub Actions: a `run: npm run typecheck` (or `tsc --noEmit`, `mypy .`, `pyright`, `cargo check`) step in `.github/workflows/ci.yml`. Pair with `types.configured` — a typechecker that's defined but never run isn't a gate, just a config file.",

  async detect(ev) {
    if (!ev.ci_workflows.present) {
      return { kind: "predicate", value: false };
    }
    for (const wf of ev.ci_workflows.workflows) {
      if (TYPECHECK_COMMAND_HINTS.some((p) => p.test(wf.raw))) {
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
      name: "workflow-runs-tsc",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: tsc --noEmit" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-runs-npm-typecheck",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: npm run typecheck" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-runs-mypy",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: mypy src" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-no-typecheck",
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
