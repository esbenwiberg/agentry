import { isDeepStrictEqual } from "node:util";
import { score as scoreReading } from "../scorer/index.js";
import type {
  AgentConfigEvidence,
  EvidenceMap,
  FilesEvidence,
  Fixture,
  GuidanceFile,
  Probe,
  Reading,
} from "../sdk/types.js";
import { errorMessage } from "../util/error-message.js";

export type FixtureOutcome =
  | { ok: true; reading: Reading; score: number | null }
  | { ok: false; reason: string };

export async function runFixture(probe: Probe, fixture: Fixture): Promise<FixtureOutcome> {
  const evidence = hydrateFixtureEvidence(fixture.evidence);

  let reading: Reading;
  try {
    reading = await probe.detect(evidence);
  } catch (err) {
    return { ok: false, reason: `detect threw: ${errorMessage(err)}` };
  }

  if (!isDeepStrictEqual(reading, fixture.expect.reading)) {
    return {
      ok: false,
      reason: `reading mismatch:\n  expected ${JSON.stringify(fixture.expect.reading)}\n  got      ${JSON.stringify(reading)}`,
    };
  }

  let s: number | null;
  try {
    s = scoreReading(reading, probe.score);
  } catch (err) {
    return { ok: false, reason: `score threw: ${errorMessage(err)}` };
  }

  if (s !== fixture.expect.score) {
    return { ok: false, reason: `score mismatch: expected ${fixture.expect.score}, got ${s}` };
  }

  return { ok: true, reading, score: s };
}

function hydrateFixtureEvidence(raw: Record<string, unknown>): EvidenceMap {
  return {
    files: hydrateFiles(raw.files),
    agent_config: hydrateAgentConfig(raw.agent_config),
  };
}

function hydrateFiles(raw: unknown): FilesEvidence {
  const paths = new Set(Array.isArray(raw) ? (raw as string[]) : []);
  return { has: (p) => paths.has(p) };
}

function hydrateAgentConfig(raw: unknown): AgentConfigEvidence {
  const obj = (raw ?? {}) as { guidance?: GuidanceFile[] };
  const guidance = obj.guidance ?? [];
  const present = new Set(guidance.map((g) => g.path));
  return { guidance, has: (p) => present.has(p) };
}
