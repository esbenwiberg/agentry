import { score } from "../scorer/index.js";
import type { EvidenceMap, Probe, Reading } from "../sdk/types.js";

export type ProbeResult = {
  probe: Probe;
  reading: Reading;
  score: number | null;
};

export async function runProbes(probes: Probe[], evidence: EvidenceMap): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const probe of probes) {
    const result = await runOne(probe, evidence);
    results.push(result);
  }
  return results;
}

async function runOne(probe: Probe, evidence: EvidenceMap): Promise<ProbeResult> {
  let reading: Reading;
  try {
    reading = await probe.detect(evidence);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reading = { kind: "error", error: message };
  }

  let s: number | null;
  try {
    s = score(reading, probe.score);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reading = { kind: "error", error: `scoring failed: ${message}` };
    s = null;
  }

  return { probe, reading, score: s };
}
