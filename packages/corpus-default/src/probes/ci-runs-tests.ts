import { defineProbe } from "@esbenwiberg/repofit/sdk";

const TEST_COMMAND_HINTS = [
  /\bnpm\s+(?:run\s+)?test\b/,
  /\bnpm\s+t\b/,
  /\byarn\s+test\b/,
  /\bpnpm\s+(?:run\s+)?test\b/,
  /\bvitest\b/,
  /\bjest\b/,
  /\bmocha\b/,
  /\bpytest\b/,
  /\bdotnet\s+test\b/,
  /\bgo\s+test\b/,
  /\bcargo\s+test\b/,
];

export default defineProbe({
  id: "ci.runs-tests",
  version: "0.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "derived",
  evidence: ["ci_workflows"],

  rationale: `
    A configured test runner only helps an agent verify itself if CI
    actually runs it. This probe looks for a recognizable test command
    inside any GitHub Actions workflow. Non-GitHub CI is out of scope until
    we add adapters for those platforms.
  `,

  async detect(ev) {
    if (!ev.ci_workflows.present) {
      return { kind: "predicate", value: false };
    }
    for (const wf of ev.ci_workflows.workflows) {
      if (TEST_COMMAND_HINTS.some((p) => p.test(wf.raw))) {
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
      name: "workflow-runs-vitest",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: npx vitest run" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-no-tests",
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
