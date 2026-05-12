import { describe, expect, test } from "vitest";
import { runFixture } from "../src/fixtures/runner.js";
import type { Probe } from "../src/sdk/types.js";

function mkPredicateProbe(detectValue: boolean): Probe {
  return {
    id: "test.probe",
    version: "0.0.0",
    dimensions: [{ id: "context", weight: 1 }],
    tier: "static",
    evidence: ["files"],
    rationale: "",
    detect: async () => ({ kind: "predicate", value: detectValue }),
    score: { kind: "predicate", direction: "positive" },
    fixtures: [],
  };
}

describe("runFixture", () => {
  test("happy path: reading and score match → ok", async () => {
    const probe = mkPredicateProbe(true);
    const outcome = await runFixture(probe, {
      name: "match",
      evidence: { files: ["x"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    });
    expect(outcome.ok).toBe(true);
  });

  test("reading mismatch surfaces a clear reason", async () => {
    const probe = mkPredicateProbe(false);
    const outcome = await runFixture(probe, {
      name: "wrong-reading",
      evidence: {},
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/reading mismatch/);
  });

  test("score mismatch surfaces a clear reason", async () => {
    const probe = mkPredicateProbe(true);
    const outcome = await runFixture(probe, {
      name: "wrong-score",
      evidence: {},
      expect: { reading: { kind: "predicate", value: true }, score: 50 },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/score mismatch/);
  });

  test("detector throwing surfaces a clear reason", async () => {
    const probe: Probe = {
      ...mkPredicateProbe(true),
      detect: async () => {
        throw new Error("boom");
      },
    };
    const outcome = await runFixture(probe, {
      name: "thrower",
      evidence: {},
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/detect threw.*boom/);
  });

  test("files fixture hydration: detector sees has(path)", async () => {
    const probe: Probe = {
      ...mkPredicateProbe(true),
      detect: async (ev) => ({ kind: "predicate", value: ev.files.has("README.md") }),
    };
    const outcome = await runFixture(probe, {
      name: "has-readme",
      evidence: { files: ["README.md"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    });
    expect(outcome.ok).toBe(true);
  });
});
