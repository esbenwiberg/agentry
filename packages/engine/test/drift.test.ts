import { describe, expect, test } from "vitest";
import type { Baseline } from "../src/loader/baseline.js";
import type { LoadedCorpus } from "../src/loader/corpus.js";
import type { Probe } from "../src/sdk/types.js";
import { detectDrift } from "../src/verdict/drift.js";

function probe(id: string): Probe {
  return {
    id,
    version: "0.0.0",
    dimensions: [],
    tier: "static",
    evidence: [],
    rationale: "",
    detect: async () => ({ kind: "predicate", value: true }),
    score: { kind: "predicate", direction: "positive" },
    fixtures: [],
  };
}

const CORPUS: LoadedCorpus = {
  name: "@esbenwiberg/corpus-default",
  version: "1.0.0",
  probes: [probe("a"), probe("b")],
  dimensions: [],
};

const baseline = (overrides: Partial<Baseline> = {}): Baseline => ({
  version: 1,
  acceptedAt: "2026-05-11T00:00:00Z",
  corpus: [{ package: CORPUS.name, version: "1.0.0" }],
  fitness: 70,
  dimensions: {},
  probes: { a: 100, b: 50 },
  ...overrides,
});

describe("detectDrift", () => {
  test("no baseline → no drift", () => {
    expect(detectDrift(CORPUS, null)).toEqual({
      newProbes: [],
      removedProbes: [],
      corpusVersionMismatches: [],
    });
  });

  test("no drift when corpus matches baseline", () => {
    const d = detectDrift(CORPUS, baseline());
    expect(d.newProbes).toEqual([]);
    expect(d.removedProbes).toEqual([]);
    expect(d.corpusVersionMismatches).toEqual([]);
  });

  test("new probe surfaces", () => {
    const d = detectDrift(CORPUS, baseline({ probes: { a: 100 } }));
    expect(d.newProbes).toEqual(["b"]);
    expect(d.removedProbes).toEqual([]);
  });

  test("removed probe surfaces", () => {
    const d = detectDrift(CORPUS, baseline({ probes: { a: 100, b: 50, c: 80 } }));
    expect(d.removedProbes).toEqual(["c"]);
  });

  test("version mismatch surfaces", () => {
    const d = detectDrift(
      CORPUS,
      baseline({ corpus: [{ package: CORPUS.name, version: "0.9.0" }] }),
    );
    expect(d.corpusVersionMismatches).toEqual([
      { package: CORPUS.name, baseline: "0.9.0", current: "1.0.0" },
    ]);
  });
});
