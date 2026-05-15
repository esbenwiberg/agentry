import { defineProbe } from "@esbenwiberg/repofit/sdk";

const LINT_COMMAND_HINTS = [
  /\bnpm\s+(?:run\s+)?lint\b/,
  /\byarn\s+lint\b/,
  /\bpnpm\s+(?:run\s+)?lint\b/,
  /\bbiome\s+(?:check|lint)\b/i,
  /\beslint\b/,
  /\boxlint\b/,
  /\bruff\s+check\b/i,
  /\bflake8\b/,
  /\bpylint\b/,
  /\bgolangci-lint\b/,
  /\bgo\s+vet\b/,
  /\bcargo\s+clippy\b/,
  /\bmvn\s+checkstyle:check\b/,
  /\bgradle\s+(?:check|checkstyle)\b/,
  /\brubocop\b/i,
  /\bstandardrb\b/i,
];

export default defineProbe({
  id: "ci.runs-lint",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "derived",
  evidence: ["ci_workflows"],

  rationale: `
    A configured linter only helps an agent if CI actually runs it.
    Local hooks are bypassable; CI is the one gate that always fires.
    This probe looks for a recognisable lint command inside any GitHub
    Actions workflow. Non-GitHub CI is out of scope until we add
    adapters for those platforms.
  `,

  remediation:
    "Add a lint step to your CI workflow. GitHub Actions: a `run: npm run lint` (or `biome check .`, `ruff check`, `golangci-lint run`, `cargo clippy`, `rubocop`) step in `.github/workflows/ci.yml`. Pair with `lint.configured` — a linter that's defined but never run on every push isn't a gate.",

  async detect(ev) {
    if (!ev.ci_workflows.present) {
      return { kind: "predicate", value: false };
    }
    for (const wf of ev.ci_workflows.workflows) {
      if (LINT_COMMAND_HINTS.some((p) => p.test(wf.raw))) {
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
      name: "workflow-runs-biome",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: npx biome check ." }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-runs-npm-lint",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/ci.yml", raw: "run: npm run lint" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "workflow-no-lint",
      evidence: {
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/test.yml", raw: "run: npm test" }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
