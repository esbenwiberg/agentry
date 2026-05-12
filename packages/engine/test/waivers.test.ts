import { describe, expect, test } from "vitest";
import { runProbes } from "../src/runner/tiered.js";
import type { EvidenceMap, Probe } from "../src/sdk/types.js";

const EMPTY_EVIDENCE: EvidenceMap = {
  files: { has: () => false, readText: async () => undefined },
  agent_config: { guidance: [], has: () => false },
  node_package: {
    present: false,
    dependencies: {},
    devDependencies: {},
    scripts: {},
    raw: null,
  },
  gitignore: { present: false, patterns: [], ignores: () => false },
};

function inventoryProbe(items: { path: string; message: string }[]): Probe {
  return {
    id: "test.inventory",
    version: "0.0.0",
    dimensions: [{ id: "x", weight: 1 }],
    tier: "static",
    evidence: [],
    rationale: "",
    detect: async () => ({
      kind: "inventory",
      items: items.map((i) => ({
        location: { path: i.path },
        severity: "warn",
        message: i.message,
      })),
    }),
    score: {
      kind: "inventory",
      severityWeights: { info: 1, warn: 1, error: 1 },
      bands: [{ upTo: 0, score: 100 }, { upTo: 1, score: 50 }, { score: 0 }],
    },
    fixtures: [],
  };
}

describe("waivers", () => {
  test("matching waiver filters out an inventory item", async () => {
    const probe = inventoryProbe([
      { path: "src/a.ts", message: "a" },
      { path: "src/b.ts", message: "b" },
    ]);
    const [result] = await runProbes([probe], EMPTY_EVIDENCE, {
      waivers: [{ probeId: "test.inventory", location: "src/a.ts", reason: "ignore" }],
    });
    if (result?.reading.kind !== "inventory") throw new Error("expected inventory");
    expect(result.reading.items.map((i) => i.location.path)).toEqual(["src/b.ts"]);
    expect(result.score).toBe(50);
  });

  test("waivers with :line strip the line suffix when matching", async () => {
    const probe = inventoryProbe([{ path: "src/a.ts", message: "a" }]);
    const [result] = await runProbes([probe], EMPTY_EVIDENCE, {
      waivers: [{ probeId: "test.inventory", location: "src/a.ts:42", reason: "fixture" }],
    });
    if (result?.reading.kind !== "inventory") throw new Error("expected inventory");
    expect(result.reading.items).toEqual([]);
    expect(result.score).toBe(100);
  });

  test("waivers for a different probe do not apply", async () => {
    const probe = inventoryProbe([{ path: "src/a.ts", message: "a" }]);
    const [result] = await runProbes([probe], EMPTY_EVIDENCE, {
      waivers: [{ probeId: "other.probe", location: "src/a.ts", reason: "x" }],
    });
    if (result?.reading.kind !== "inventory") throw new Error("expected inventory");
    expect(result.reading.items).toHaveLength(1);
  });
});
