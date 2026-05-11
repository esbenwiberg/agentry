import { defineProbe } from "@esbenwiberg/repofit/sdk";

const SECRET_TOOL_HINTS = [
  /\bsecretlint\b/i,
  /\bgitleaks\b/i,
  /\btruffle?hog\b/i,
  /\bdetect-secrets\b/i,
  /\bggshield\b/i,
  /\btrivy\s+fs\b/i,
];

const PRECOMMIT_PATHS = [
  ".pre-commit-config.yaml",
  ".pre-commit-config.yml",
  ".husky/pre-commit",
  ".githooks/pre-commit",
];

export default defineProbe({
  id: "secrets.precommit-scan-configured",
  version: "0.0.0",
  dimensions: [{ id: "safety", weight: 1 }],
  tier: "derived",
  evidence: ["files", "ci_workflows"],

  rationale: `
    A pre-commit or CI step that scans for secrets is the only durable
    defense against accidentally committing a token. Without it, prevention
    relies on every human and every agent remembering to check by hand.
  `,

  async detect(ev) {
    for (const path of PRECOMMIT_PATHS) {
      const raw = await ev.files.readText(path);
      if (raw && SECRET_TOOL_HINTS.some((p) => p.test(raw))) {
        return { kind: "predicate", value: true };
      }
    }
    for (const wf of ev.ci_workflows.workflows) {
      if (SECRET_TOOL_HINTS.some((p) => p.test(wf.raw))) {
        return { kind: "predicate", value: true };
      }
    }
    return { kind: "predicate", value: false };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "nothing-configured",
      evidence: {
        files: [],
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "secretlint-in-husky",
      evidence: {
        files: { ".husky/pre-commit": "npx secretlint --maskSecrets '**/*'\n" },
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "gitleaks-in-ci",
      evidence: {
        files: [],
        ci_workflows: {
          present: true,
          workflows: [
            { path: ".github/workflows/security.yml", raw: "uses: zricethezav/gitleaks-action@v2" },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
  ],
});
