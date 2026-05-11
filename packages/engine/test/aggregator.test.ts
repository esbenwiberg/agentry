import { describe, expect, test } from "vitest";
import { aggregate } from "../src/aggregator/index.js";
import type { ProbeResult } from "../src/runner/sequential.js";
import type { DimensionRecipe, Probe } from "../src/sdk/types.js";

function mkProbe(id: string, dimWeight: { id: string; weight: number }[]): Probe {
  return {
    id,
    version: "0.0.0",
    dimensions: dimWeight,
    tier: "static",
    evidence: [],
    rationale: "",
    detect: async () => ({ kind: "predicate", value: true }),
    score: { kind: "predicate", direction: "positive" },
    fixtures: [],
  };
}

function mkDim(
  id: string,
  gating = false,
  overrides?: { probeId: string; weight: number }[],
): DimensionRecipe {
  return {
    id,
    name: id,
    description: "",
    gating,
    ...(overrides ? { overrides } : {}),
  };
}

describe("aggregator", () => {
  test("single dim, single probe, score passes through", () => {
    const probe = mkProbe("p1", [{ id: "context", weight: 1 }]);
    const results: ProbeResult[] = [
      { probe, reading: { kind: "predicate", value: true }, score: 100 },
    ];

    const out = aggregate(results, [mkDim("context")]);

    expect(out.dimensions).toHaveLength(1);
    expect(out.dimensions[0]?.score).toBe(100);
    expect(out.fitness).toBe(100);
  });

  test("weighted average within a dimension", () => {
    const p1 = mkProbe("p1", [{ id: "context", weight: 1 }]);
    const p2 = mkProbe("p2", [{ id: "context", weight: 3 }]);
    const results: ProbeResult[] = [
      { probe: p1, reading: { kind: "predicate", value: true }, score: 100 },
      { probe: p2, reading: { kind: "predicate", value: false }, score: 0 },
    ];

    const out = aggregate(results, [mkDim("context")]);

    // (100*1 + 0*3) / (1+3) = 25
    expect(out.dimensions[0]?.score).toBe(25);
  });

  test("dimension override re-weights a probe", () => {
    const p1 = mkProbe("p1", [{ id: "context", weight: 1 }]);
    const p2 = mkProbe("p2", [{ id: "context", weight: 3 }]);
    const results: ProbeResult[] = [
      { probe: p1, reading: { kind: "predicate", value: true }, score: 100 },
      { probe: p2, reading: { kind: "predicate", value: false }, score: 0 },
    ];

    const out = aggregate(results, [mkDim("context", false, [{ probeId: "p2", weight: 0 }])]);

    expect(out.dimensions[0]?.score).toBe(100);
  });

  test("na/error probes don't drag the score", () => {
    const p1 = mkProbe("p1", [{ id: "context", weight: 1 }]);
    const p2 = mkProbe("p2", [{ id: "context", weight: 1 }]);
    const results: ProbeResult[] = [
      { probe: p1, reading: { kind: "predicate", value: true }, score: 100 },
      { probe: p2, reading: { kind: "error", error: "x" }, score: null },
    ];

    const out = aggregate(results, [mkDim("context")]);

    expect(out.dimensions[0]?.score).toBe(100);
    expect(out.dimensions[0]?.probeCount).toBe(1);
  });

  test("empty dimension → null score", () => {
    const out = aggregate([], [mkDim("context")]);
    expect(out.dimensions[0]?.score).toBeNull();
    expect(out.fitness).toBeNull();
  });
});
