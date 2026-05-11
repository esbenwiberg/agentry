import { defineProbe } from "@esbenwiberg/repofit/sdk";

const FORMATTERS = ["prettier", "@biomejs/biome", "dprint"];

export default defineProbe({
  id: "format.configured",
  version: "0.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  tier: "static",
  evidence: ["node_package"],

  rationale: `
    A configured formatter is the cheapest possible insurance that an
    agent's diff blends in with the rest of the codebase. Without one, the
    agent's whitespace, quoting, and line-wrap defaults leak into every
    edit and reviewers spend cycles on style instead of substance.
  `,

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const hasFormatterDep = FORMATTERS.some((f) => f in ev.node_package.devDependencies);
    const hasFormatScript = typeof ev.node_package.scripts.format === "string";
    return { kind: "predicate", value: hasFormatterDep || hasFormatScript };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "prettier-devdep",
      evidence: {
        node_package: { present: true, devDependencies: { prettier: "^3.0.0" } },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "format-script-only",
      evidence: { node_package: { present: true, scripts: { format: "biome format --write ." } } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "no-formatter",
      evidence: { node_package: { present: true } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
