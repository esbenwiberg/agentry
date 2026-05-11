import { isDeepStrictEqual } from "node:util";
import ignore from "ignore";
import { score as scoreReading } from "../scorer/index.js";
import type {
  AgentConfigEvidence,
  EvidenceMap,
  FilesEvidence,
  Fixture,
  GitignoreEvidence,
  GuidanceFile,
  NodePackageEvidence,
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
    node_package: hydrateNodePackage(raw.node_package),
    gitignore: hydrateGitignore(raw.gitignore),
  };
}

function hydrateFiles(raw: unknown): FilesEvidence {
  let paths: Set<string>;
  let contents: Map<string, string>;
  if (Array.isArray(raw)) {
    paths = new Set(raw as string[]);
    contents = new Map();
  } else if (raw && typeof raw === "object") {
    const map = raw as Record<string, string>;
    paths = new Set(Object.keys(map));
    contents = new Map(Object.entries(map));
  } else {
    paths = new Set();
    contents = new Map();
  }
  return {
    has: (p) => paths.has(p),
    readText: async (p) => contents.get(p),
  };
}

function hydrateAgentConfig(raw: unknown): AgentConfigEvidence {
  const obj = (raw ?? {}) as { guidance?: GuidanceFile[] };
  const guidance = obj.guidance ?? [];
  const present = new Set(guidance.map((g) => g.path));
  return { guidance, has: (p) => present.has(p) };
}

function hydrateNodePackage(raw: unknown): NodePackageEvidence {
  if (!raw || typeof raw !== "object") {
    return {
      present: false,
      dependencies: {},
      devDependencies: {},
      scripts: {},
      raw: null,
    };
  }
  const obj = raw as Partial<NodePackageEvidence>;
  return {
    present: obj.present ?? true,
    dependencies: obj.dependencies ?? {},
    devDependencies: obj.devDependencies ?? {},
    scripts: obj.scripts ?? {},
    raw: obj.raw ?? null,
  };
}

function hydrateGitignore(raw: unknown): GitignoreEvidence {
  if (!raw || typeof raw !== "object") {
    return { present: false, patterns: [], ignores: () => false };
  }
  const obj = raw as { patterns?: string[]; present?: boolean };
  const patterns = obj.patterns ?? [];
  const matcher = ignore().add(patterns);
  return {
    present: obj.present ?? patterns.length > 0,
    patterns,
    ignores: (p) => matcher.ignores(p),
  };
}
