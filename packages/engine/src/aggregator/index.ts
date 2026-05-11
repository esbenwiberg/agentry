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
  const overrideWeights = new Map(recipe.overrides?.map((o) => [o.probeId, o.weight]));

  let totalWeight = 0;
  let weightedSum = 0;
  let probeCount = 0;

  for (const r of results) {
    if (r.score === null) continue;
    const assignment = r.probe.dimensions.find((d) => d.id === recipe.id);
    if (!assignment) continue;
    probeCount += 1;
    const weight = overrideWeights.get(r.probe.id) ?? assignment.weight;
    if (weight <= 0) continue;
    weightedSum += r.score * weight;
    totalWeight += weight;
  }

  return {
    id: recipe.id,
    name: recipe.name,
    score: totalWeight === 0 ? null : weightedSum / totalWeight,
    gating: recipe.gating,
    probeCount,
  };
}
