import { score } from "../scorer/index.js";
import type { EvidenceMap, Probe, Reading, Tier } from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";

export type ProbeResult = {
  probe: Probe;
  reading: Reading;
  score: number | null;
};

const TIER_ORDER: Tier[] = ["static", "derived", "historical", "executed", "reasoned"];

export async function runProbes(probes: Probe[], evidence: EvidenceMap): Promise<ProbeResult[]> {
  const buckets = groupByTier(probes);
  const results: ProbeResult[] = [];
  for (const tier of TIER_ORDER) {
    const bucket = buckets.get(tier);
    if (!bucket || bucket.length === 0) continue;
    const tierResults = await Promise.all(bucket.map((p) => runOne(p, evidence)));
    results.push(...tierResults);
  }
  return results;
}

function groupByTier(probes: Probe[]): Map<Tier, Probe[]> {
  const buckets = new Map<Tier, Probe[]>();
  for (const probe of probes) {
    const bucket = buckets.get(probe.tier);
    if (bucket) bucket.push(probe);
    else buckets.set(probe.tier, [probe]);
  }
  return buckets;
}

async function runOne(probe: Probe, evidence: EvidenceMap): Promise<ProbeResult> {
  let reading: Reading;
  try {
    reading = await probe.detect(evidence);
  } catch (err) {
    return { probe, reading: { kind: "error", error: errorMessage(err) }, score: null };
  }

  try {
    return { probe, reading, score: score(reading, probe.score) };
  } catch (err) {
    return {
      probe,
      reading: { kind: "error", error: `scoring failed: ${errorMessage(err)}` },
      score: null,
    };
  }
}
