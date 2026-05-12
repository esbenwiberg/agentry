import type { EffectiveDimension } from "../loader/effective-dimensions.js";
import type { ProbeResult } from "../runner/tiered.js";

export type DimensionResult = {
  id: string;
  name: string;
  score: number | null;
  gating: boolean;
  weight: number;
  threshold: number | null;
  gatingThreshold: number | null;
  probeCount: number;
};

export type Aggregated = {
  dimensions: DimensionResult[];
  fitness: number | null;
};

export function aggregate(results: ProbeResult[], dimensions: EffectiveDimension[]): Aggregated {
  const dims: DimensionResult[] = dimensions.map((dim) => scoreDimension(dim, results));

  let totalWeight = 0;
  let weightedSum = 0;
  for (const d of dims) {
    if (d.score === null) continue;
    if (d.weight <= 0) continue;
    weightedSum += d.score * d.weight;
    totalWeight += d.weight;
  }

  let fitness = totalWeight === 0 ? null : weightedSum / totalWeight;

  if (fitness !== null) {
    for (const d of dims) {
      if (!d.gating || d.gatingThreshold === null || d.score === null) continue;
      if (d.score < d.gatingThreshold) fitness = Math.min(fitness, d.score);
    }
  }

  return { dimensions: dims, fitness };
}

function scoreDimension(dim: EffectiveDimension, results: ProbeResult[]): DimensionResult {
  const overrideWeights = new Map(dim.overrides?.map((o) => [o.probeId, o.weight]));

  let totalWeight = 0;
  let weightedSum = 0;
  let probeCount = 0;

  for (const r of results) {
    if (r.score === null) continue;
    const assignment = r.probe.dimensions.find((d) => d.id === dim.id);
    if (!assignment) continue;
    probeCount += 1;
    const weight = overrideWeights.get(r.probe.id) ?? assignment.weight;
    if (weight <= 0) continue;
    weightedSum += r.score * weight;
    totalWeight += weight;
  }

  return {
    id: dim.id,
    name: dim.name,
    score: totalWeight === 0 ? null : weightedSum / totalWeight,
    gating: dim.gating,
    weight: dim.weight ?? 1,
    threshold: dim.threshold ?? null,
    gatingThreshold: dim.gatingThreshold ?? null,
    probeCount,
  };
}
