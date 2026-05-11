import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "types.configured",
  version: "0.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["files", "node_package"],

  rationale: `
    Type checking is a fast, structural feedback loop — an agent that can
    run "tsc --noEmit" catches whole categories of mistakes before tests
    even run. Detecting a tsconfig.json or a typescript devDep is a cheap
    proxy for whether this loop exists at all.
  `,

  async detect(ev) {
    const hasTsconfig = ev.files.has("tsconfig.json");
    const hasTypescriptDep =
      ev.node_package.present && "typescript" in ev.node_package.devDependencies;
    return { kind: "predicate", value: hasTsconfig || hasTypescriptDep };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "tsconfig-present",
      evidence: { files: ["tsconfig.json"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "typescript-devdep",
      evidence: {
        files: [],
        node_package: { present: true, devDependencies: { typescript: "^5.0.0" } },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "neither",
      evidence: { files: [] },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
