import type { DimensionRecipe, DimensionOverride as ProbeDimensionOverride } from "../sdk/types.js";
import type { DimensionConfigOverride, ProjectConfig } from "./config.js";

export type EffectiveDimension = DimensionRecipe & {
  weight?: number;
  threshold?: number;
  gatingThreshold?: number;
};

export function effectiveDimensions(
  recipes: DimensionRecipe[],
  config: ProjectConfig,
): EffectiveDimension[] {
  const projectDims = config.dimensions ?? {};
  return recipes.map((recipe) => mergeOne(recipe, projectDims[recipe.id]));
}

function mergeOne(
  recipe: DimensionRecipe,
  override: DimensionConfigOverride | undefined,
): EffectiveDimension {
  if (!override) return { ...recipe };

  const corpusOverrides = recipe.overrides ?? [];
  const projectProbes = override.probes ?? {};

  const merged = new Map<string, ProbeDimensionOverride>();
  for (const o of corpusOverrides) merged.set(o.probeId, { ...o });
  for (const [probeId, probeOverride] of Object.entries(projectProbes)) {
    const weight = probeOverride.disabled ? 0 : probeOverride.weight;
    if (weight === undefined) continue;
    merged.set(probeId, { probeId, weight });
  }

  const out: EffectiveDimension = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    gating: override.gating ?? recipe.gating,
  };
  if (merged.size > 0) out.overrides = [...merged.values()];
  if (override.weight !== undefined) out.weight = override.weight;
  if (override.threshold !== undefined) out.threshold = override.threshold;
  if (override.gatingThreshold !== undefined) out.gatingThreshold = override.gatingThreshold;
  return out;
}
