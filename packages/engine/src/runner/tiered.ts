import type { Waiver } from "../loader/config.js";
import { score } from "../scorer/index.js";
import type { EvidenceMap, Probe, Reading, Tier } from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";

export type ProbeResult = {
  probe: Probe;
  reading: Reading;
  score: number | null;
};

export type RunOptions = {
  waivers?: Waiver[];
};

const TIER_ORDER: Tier[] = ["static", "derived", "historical", "executed", "reasoned"];

export async function runProbes(
  probes: Probe[],
  evidence: EvidenceMap,
  opts: RunOptions = {},
): Promise<ProbeResult[]> {
  const waiversByProbe = groupWaivers(opts.waivers ?? []);
  const buckets = groupByTier(probes);
  const results: ProbeResult[] = [];
  for (const tier of TIER_ORDER) {
    const bucket = buckets.get(tier);
    if (!bucket || bucket.length === 0) continue;
    const tierResults = await Promise.all(
      bucket.map((p) => runOne(p, evidence, waiversByProbe.get(p.id) ?? [])),
    );
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

function groupWaivers(waivers: Waiver[]): Map<string, Waiver[]> {
  const out = new Map<string, Waiver[]>();
  for (const w of waivers) {
    const bucket = out.get(w.probeId);
    if (bucket) bucket.push(w);
    else out.set(w.probeId, [w]);
  }
  return out;
}

async function runOne(
  probe: Probe,
  evidence: EvidenceMap,
  waivers: Waiver[],
): Promise<ProbeResult> {
  let reading: Reading;
  try {
    reading = await probe.detect(evidence);
  } catch (err) {
    return { probe, reading: { kind: "error", error: errorMessage(err) }, score: null };
  }

  const filtered = applyWaivers(reading, waivers);

  try {
    return { probe, reading: filtered, score: score(filtered, probe.score) };
  } catch (err) {
    return {
      probe,
      reading: { kind: "error", error: `scoring failed: ${errorMessage(err)}` },
      score: null,
    };
  }
}

function applyWaivers(reading: Reading, waivers: Waiver[]): Reading {
  if (reading.kind !== "inventory" || waivers.length === 0) return reading;
  const items = reading.items.filter(
    (item) => !waivers.some((w) => matchesWaiver(w, item.location.path)),
  );
  if (items.length === reading.items.length) return reading;
  return { kind: "inventory", items };
}

function matchesWaiver(waiver: Waiver, path: string): boolean {
  const [waivedPath] = waiver.location.split(":", 1);
  return waivedPath === path;
}
