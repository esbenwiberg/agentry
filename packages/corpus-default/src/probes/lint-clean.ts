import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "lint.clean",
  version: "1.0.0",
  dimensions: [
    { id: "feedback", weight: 1 },
    { id: "consistency", weight: 0.5 },
  ],
  tier: "executed",
  evidence: ["node_package", "commands"],

  rationale: `
    A configured linter that the codebase doesn't actually pass is a
    half-set gate. This runs the lint script and reports clean only
    when it exits zero.
  `,

  remediation:
    "Run `npm run lint` (or the equivalent for your language) and fix or autofix every warning until it exits clean. Add a pre-commit hook or CI gate so the tree stays green. A linter that's configured but ignored is worse than no linter — it trains everyone to ignore warnings.",

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const script = ev.node_package.scripts.lint;
    if (typeof script !== "string" || script.trim().length === 0) {
      return { kind: "na", reason: "no lint script" };
    }
    const run = await ev.commands.run({
      argv: ["npm", "run", "lint", "--silent"],
      timeoutMs: 300_000,
    });
    if (run.timedOut) return { kind: "na", reason: "lint command timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "no-lint-script",
      evidence: { node_package: { present: true, scripts: {} } },
      expect: { reading: { kind: "na", reason: "no lint script" }, score: null },
    },
    {
      name: "lint-clean",
      evidence: {
        node_package: { present: true, scripts: { lint: "biome check ." } },
        commands: [{ argv: ["npm", "run", "lint", "--silent"], exitCode: 0, durationMs: 500 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "lint-dirty",
      evidence: {
        node_package: { present: true, scripts: { lint: "biome check ." } },
        commands: [{ argv: ["npm", "run", "lint", "--silent"], exitCode: 1, durationMs: 500 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
