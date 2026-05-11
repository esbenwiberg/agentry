import type { ProbeResult } from "../runner/sequential.js";
import type { DimensionRecipe } from "../sdk/types.js";

export type DimensionResult = {
  id: string;
  name: string;
  score: number | null;
  gating: boolean;
  probeCount: number;
};

export type Aggregated = {
  dimensions: DimensionResult[];
  fitness: number | null;
};

// Phase 1: equal weight per dimension at the overall level (per-dimension
// weighting from config lands in Phase 3). Within a dimension, probe weights
// come from the probe's declared dimension assignments.
export function aggregate(results: ProbeResult[], recipes: DimensionRecipe[]): Aggregated {
  const dimensions: DimensionResult[] = recipes.map((recipe) => scoreDimension(recipe, results));

  const scored = dimensions.filter(
    (d): d is DimensionResult & { score: number } => d.score !== null,
  );
  const fitness =
    scored.length === 0 ? null : scored.reduce((sum, d) => sum + d.score, 0) / scored.length;

  return { dimensions, fitness };
}

function scoreDimension(recipe: DimensionRecipe, results: ProbeResult[]): DimensionResult {
  const contributing = results.filter(
    (r) => r.score !== null && r.probe.dimensions.some((d) => d.id === recipe.id),
  );

  if (contributing.length === 0) {
    return {
      id: recipe.id,
      name: recipe.name,
      score: null,
      gating: recipe.gating,
      probeCount: 0,
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const r of contributing) {
    const assignment = r.probe.dimensions.find((d) => d.id === recipe.id);
    if (!assignment) continue;
    const weight = applyOverride(recipe, r.probe.id, assignment.weight);
    if (weight <= 0) continue;
    weightedSum += (r.score ?? 0) * weight;
    totalWeight += weight;
  }

  const score = totalWeight === 0 ? null : weightedSum / totalWeight;
  return {
    id: recipe.id,
    name: recipe.name,
    score,
    gating: recipe.gating,
    probeCount: contributing.length,
  };
}

function applyOverride(recipe: DimensionRecipe, probeId: string, baseWeight: number): number {
  const override = recipe.overrides?.find((o) => o.probeId === probeId);
  return override ? override.weight : baseWeight;
}
