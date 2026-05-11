import { defineProbe } from "@esbenwiberg/repofit/sdk";

const LINTERS = ["@biomejs/biome", "eslint", "oxlint", "rome", "standard", "xo"];

export default defineProbe({
  id: "lint.configured",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["node_package"],

  rationale: `
    A configured linter gives the agent a fast, deterministic check that
    its diff doesn't break local conventions. Without one, an agent's
    cleanup or refactor work drifts from the project's style and reviewers
    spend cycles on nits the tool would have caught.
  `,

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const hasLinterDep = LINTERS.some((l) => l in ev.node_package.devDependencies);
    const hasLintScript = typeof ev.node_package.scripts.lint === "string";
    return { kind: "predicate", value: hasLinterDep || hasLintScript };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "biome-devdep",
      evidence: {
        node_package: { present: true, devDependencies: { "@biomejs/biome": "^2.0.0" } },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "lint-script-only",
      evidence: { node_package: { present: true, scripts: { lint: "tsc --noEmit" } } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "no-linter",
      evidence: { node_package: { present: true } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
