import { describe, expect, test } from "vitest";
import type { Aggregated, DimensionResult } from "../src/aggregator/index.js";
import type { Baseline } from "../src/loader/baseline.js";
import type { ProjectConfig } from "../src/loader/config.js";
import { computeVerdict } from "../src/verdict/index.js";

function dim(
  id: string,
  score: number | null,
  extra: Partial<DimensionResult> = {},
): DimensionResult {
  return {
    id,
    name: id,
    score,
    gating: false,
    weight: 1,
    threshold: null,
    gatingThreshold: null,
    probeCount: 1,
    ...extra,
  };
}

function aggOf(dims: DimensionResult[], fitness: number | null): Aggregated {
  return { dimensions: dims, fitness };
}

function baseOf(dims: Record<string, number | null>, fitness: number | null = 70): Baseline {
  return {
    version: 1,
    acceptedAt: "2026-05-11T00:00:00Z",
    corpus: [{ package: "x", version: "0.0.0" }],
    fitness,
    dimensions: dims,
    probes: {},
  };
}

describe("verdict — advisory", () => {
  test("always passes regardless of scores", () => {
    const v = computeVerdict(
      aggOf([dim("a", 0)], 0),
      { version: 1, gate: { mode: "advisory" } },
      null,
    );
    expect(v.pass).toBe(true);
    expect(v.reasons).toEqual([]);
  });
});

describe("verdict — ratchet", () => {
  const config: ProjectConfig = { version: 1, gate: { mode: "ratchet" } };

  test("missing baseline fails with actionable reason", () => {
    const v = computeVerdict(aggOf([dim("a", 80)], 80), config, null);
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toMatch(/no baseline/);
  });

  test("equal-or-better than baseline → pass", () => {
    const v = computeVerdict(aggOf([dim("a", 80)], 80), config, baseOf({ a: 75 }));
    expect(v.pass).toBe(true);
  });

  test("regression fails with dimension and delta in reason", () => {
    const v = computeVerdict(aggOf([dim("a", 60)], 60), config, baseOf({ a: 80 }));
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toMatch(/a:.*60.*< baseline.*80/);
  });

  test("new dimension (not in baseline) passes", () => {
    const v = computeVerdict(aggOf([dim("a", 50)], 50), config, baseOf({}));
    expect(v.pass).toBe(true);
  });
});

describe("verdict — absolute", () => {
  test("fitness below absoluteThreshold fails", () => {
    const v = computeVerdict(
      aggOf([dim("a", 50)], 50),
      { version: 1, gate: { mode: "absolute", absoluteThreshold: 70 } },
      null,
    );
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toMatch(/fitness.*< threshold 70/);
  });

  test("per-dimension threshold fails independently", () => {
    const v = computeVerdict(
      aggOf([dim("a", 50, { threshold: 60 })], 75),
      { version: 1, gate: { mode: "absolute" } },
      null,
    );
    expect(v.pass).toBe(false);
    expect(v.reasons[0]).toMatch(/a:.*< threshold 60/);
  });

  test("both thresholds met → pass", () => {
    const v = computeVerdict(
      aggOf([dim("a", 80, { threshold: 60 })], 80),
      { version: 1, gate: { mode: "absolute", absoluteThreshold: 70 } },
      null,
    );
    expect(v.pass).toBe(true);
  });
});
