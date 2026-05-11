import type { Baseline } from "../loader/baseline.js";
import type { CorpusPin } from "../loader/config.js";
import type { LoadedCorpus } from "../loader/corpus.js";

export type Drift = {
  newProbes: string[];
  removedProbes: string[];
  corpusVersionMismatches: { package: string; baseline: string; current: string }[];
};

export function detectDrift(corpus: LoadedCorpus, baseline: Baseline | null): Drift {
  if (baseline === null) {
    return { newProbes: [], removedProbes: [], corpusVersionMismatches: [] };
  }

  const corpusProbeIds = new Set(corpus.probes.map((p) => p.id));
  const baselineProbeIds = new Set(Object.keys(baseline.probes));

  const newProbes = [...corpusProbeIds].filter((id) => !baselineProbeIds.has(id)).sort();
  const removedProbes = [...baselineProbeIds].filter((id) => !corpusProbeIds.has(id)).sort();
  const corpusVersionMismatches = versionMismatches(corpus, baseline.corpus);

  return { newProbes, removedProbes, corpusVersionMismatches };
}

function versionMismatches(
  corpus: LoadedCorpus,
  baselinePins: CorpusPin[],
): Drift["corpusVersionMismatches"] {
  const mismatches: Drift["corpusVersionMismatches"] = [];
  const pin = baselinePins.find((p) => p.package === corpus.name);
  if (pin && pin.version !== corpus.version) {
    mismatches.push({ package: corpus.name, baseline: pin.version, current: corpus.version });
  }
  return mismatches;
}
