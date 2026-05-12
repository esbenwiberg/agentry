import type { DimensionRecipe, Probe } from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";

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

const DEFAULT_CORPUS_PACKAGE = "@esbenwiberg/corpus-default";

export async function loadDefaultCorpus(): Promise<LoadedCorpus> {
  let mod: CorpusModule;
  try {
    mod = (await import(DEFAULT_CORPUS_PACKAGE)) as CorpusModule;
  } catch (err) {
    throw new Error(`failed to load corpus '${DEFAULT_CORPUS_PACKAGE}': ${errorMessage(err)}`);
  }

  if (!Array.isArray(mod.probes) || mod.probes.length === 0) {
    throw new Error(`corpus '${DEFAULT_CORPUS_PACKAGE}' exports no probes`);
  }
  if (!Array.isArray(mod.dimensions) || mod.dimensions.length === 0) {
    throw new Error(`corpus '${DEFAULT_CORPUS_PACKAGE}' exports no dimensions`);
  }

  return {
    name: mod.meta?.name ?? DEFAULT_CORPUS_PACKAGE,
    version: mod.meta?.version ?? "0.0.0",
    probes: mod.probes,
    dimensions: mod.dimensions,
  };
}
