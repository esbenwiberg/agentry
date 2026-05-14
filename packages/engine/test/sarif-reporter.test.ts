import { describe, expect, test } from "vitest";
import type { Aggregated } from "../src/aggregator/index.js";
import type { LoadedCorpus } from "../src/loader/corpus.js";
import type { ReportInput } from "../src/reporters/json.js";
import { buildSarif } from "../src/reporters/sarif.js";
import type { ProbeResult } from "../src/runner/tiered.js";
import type { Probe, Reading } from "../src/sdk/types.js";
import type { Verdict } from "../src/verdict/index.js";

const probe = (id: string, overrides: Partial<Probe> = {}): Probe => ({
  id,
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["files"] as const,
  rationale: "A rationale for the probe.",
  remediation: "Fix it.",
  detect: async () => ({ kind: "predicate", value: true }),
  score: { kind: "predicate", direction: "positive" },
  fixtures: [],
  ...overrides,
});

const corpus: LoadedCorpus = {
  name: "@x/corpus",
  version: "1.2.3",
  probes: [],
  dimensions: [],
};

function inputFrom(results: ProbeResult[]): ReportInput {
  const aggregated: Aggregated = {
    fitness: 80,
    dimensions: [],
  };
  const verdict: Verdict = { mode: "advisory", pass: true, reasons: [], dimensions: [] };
  return {
    cwd: "/repo",
    corpus,
    config: { gateMode: "advisory" },
    aggregated,
    results,
    verdict,
    drift: { newProbes: [], removedProbes: [], corpusVersionMismatches: [] },
    baseline: null,
    ranAt: "2026-05-13T00:00:00Z",
  };
}

function result(p: Probe, reading: Reading, score: number | null): ProbeResult {
  return { probe: p, reading, score };
}

describe("sarif reporter", () => {
  test("emits SARIF 2.1.0 envelope with driver metadata", () => {
    const sarif = buildSarif(inputFrom([]));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    const driver = sarif.runs[0].tool.driver;
    expect(driver.name).toBe("repofit");
    expect(driver.version).toBe("1.2.3");
    expect(driver.informationUri).toMatch(/github\.com\/esbenwiberg\/repofit/);
    expect(sarif.runs[0].invocations[0].executionSuccessful).toBe(true);
  });

  test("skips passing probes", () => {
    const r = result(probe("docs.readme-present"), { kind: "predicate", value: true }, 100);
    const sarif = buildSarif(inputFrom([r]));
    expect(sarif.runs[0].results).toHaveLength(0);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(0);
  });

  test("emits one result per inventory item with severity → level", () => {
    const r = result(
      probe("safety.dangerous-scripts"),
      {
        kind: "inventory",
        items: [
          { location: { path: "scripts/a.sh" }, severity: "error", message: "uses rm -rf" },
          { location: { path: "scripts/b.sh" }, severity: "warn", message: "missing set -e" },
          { location: { path: "scripts/c.sh" }, severity: "info", message: "trivial nit" },
        ],
      },
      50,
    );
    const sarif = buildSarif(inputFrom([r]));
    const results = sarif.runs[0].results;
    expect(results).toHaveLength(3);
    expect(results[0].level).toBe("error");
    expect(results[1].level).toBe("warning");
    expect(results[2].level).toBe("note");
    expect(results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("scripts/a.sh");
    expect(results[0].message.text).toMatch(/uses rm -rf/);
    expect(results[0].message.text).toMatch(/Fix it\./);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
  });

  test("emits one result per count sample", () => {
    const r = result(
      probe("size.large-files"),
      {
        kind: "count",
        value: 2,
        samples: [{ path: "a.json" }, { path: "b.json" }],
      },
      40,
    );
    const sarif = buildSarif(inputFrom([r]));
    expect(sarif.runs[0].results).toHaveLength(2);
    expect(sarif.runs[0].results[0].level).toBe("warning");
  });

  test("falling predicate emits a root-level result", () => {
    const r = result(probe("docs.readme-present"), { kind: "predicate", value: false }, 0);
    const sarif = buildSarif(inputFrom([r]));
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(".");
    expect(sarif.runs[0].results[0].level).toBe("warning");
  });

  test("na and error readings produce no results", () => {
    const naResult = result(
      probe("git.branch-protection"),
      { kind: "na", reason: "no token" },
      null,
    );
    const errResult = result(probe("oops"), { kind: "error", error: "boom" }, null);
    const sarif = buildSarif(inputFrom([naResult, errResult]));
    expect(sarif.runs[0].results).toHaveLength(0);
  });

  test("rule index references match results", () => {
    const r1 = result(
      probe("size.large-files"),
      { kind: "count", value: 1, samples: [{ path: "a.json" }] },
      50,
    );
    const r2 = result(probe("docs.readme-present"), { kind: "predicate", value: false }, 0);
    const sarif = buildSarif(inputFrom([r1, r2]));
    const rules = sarif.runs[0].tool.driver.rules;
    const results = sarif.runs[0].results;
    for (const res of results) {
      expect(rules[res.ruleIndex].id).toBe(res.ruleId);
    }
  });

  test("fingerprint is stable per probe+path", () => {
    const r = result(
      probe("size.large-files"),
      { kind: "count", value: 1, samples: [{ path: "a.json" }] },
      50,
    );
    const a = buildSarif(inputFrom([r])).runs[0].results[0].partialFingerprints;
    const b = buildSarif(inputFrom([r])).runs[0].results[0].partialFingerprints;
    expect(a).toEqual(b);
    expect(a?.["probeIdAndPath/v1"]).toBe("size.large-files|a.json");
  });
});
