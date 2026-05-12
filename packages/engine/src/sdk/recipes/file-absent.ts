import { defineProbe } from "../define-probe.js";
import type { DimensionAssignment, Fixture, Probe, Tier } from "../types.js";

export type FileAbsentRecipe = {
  id: string;
  version: string;
  dimensions: DimensionAssignment[];
  tier?: Tier;
  rationale: string;
  path: string;
  fixtures?: Fixture[];
};

export function fileAbsent(spec: FileAbsentRecipe): Probe {
  const fixtures: Fixture[] = spec.fixtures ?? [
    {
      name: "absent",
      evidence: { files: [] },
      expect: { reading: { kind: "predicate", value: false }, score: 100 },
    },
    {
      name: "present",
      evidence: { files: [spec.path] },
      expect: { reading: { kind: "predicate", value: true }, score: 0 },
    },
  ];

  return defineProbe({
    id: spec.id,
    version: spec.version,
    dimensions: spec.dimensions,
    tier: spec.tier ?? "static",
    evidence: ["files"],
    rationale: spec.rationale,
    detect: async (ev) => ({ kind: "predicate", value: ev.files.has(spec.path) }),
    score: { kind: "predicate", direction: "negative" },
    fixtures,
  });
}
