import { score } from "../scorer/index.js";
import type { EvidenceMap, Probe, Reading } from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";

export type ProbeResult = {
  probe: Probe;
  reading: Reading;
  score: number | null;
};

export async function runProbes(probes: Probe[], evidence: EvidenceMap): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const probe of probes) {
    results.push(await runOne(probe, evidence));
  }
  return results;
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
