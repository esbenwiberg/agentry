import type { DimensionRecipe, Probe } from "../sdk/types.js";

export type LoadedCorpus = {
  name: string;
  version: string;
  probes: Probe[];
  dimensions: DimensionRecipe[];
};

type CorpusModule = {
  meta?: { name?: string; version?: string };
  probes?: Probe[];
  dimensions?: DimensionRecipe[];
};

// Default corpus package. Phase 1 hardcodes this; config-driven corpus
// pinning lands in Phase 3.
const DEFAULT_CORPUS_PACKAGE = "@esbenwiberg/corpus-default";

export async function loadDefaultCorpus(): Promise<LoadedCorpus> {
  return loadCorpus(DEFAULT_CORPUS_PACKAGE);
}

export async function loadCorpus(packageName: string): Promise<LoadedCorpus> {
  let mod: CorpusModule;
  try {
    mod = (await import(packageName)) as CorpusModule;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to load corpus '${packageName}': ${message}`);
  }

  if (!Array.isArray(mod.probes) || mod.probes.length === 0) {
    throw new Error(`corpus '${packageName}' exports no probes`);
  }
  if (!Array.isArray(mod.dimensions) || mod.dimensions.length === 0) {
    throw new Error(`corpus '${packageName}' exports no dimensions`);
  }

  return {
    name: mod.meta?.name ?? packageName,
    version: mod.meta?.version ?? "0.0.0",
    probes: mod.probes,
    dimensions: mod.dimensions,
  };
}
