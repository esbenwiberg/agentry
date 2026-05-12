import { describe, expect, test } from "vitest";
import { effectiveDimensions } from "../src/loader/effective-dimensions.js";
import type { DimensionRecipe } from "../src/sdk/types.js";

const baseRecipe: DimensionRecipe = {
  id: "context",
  name: "Context",
  description: "",
  gating: false,
};

describe("effectiveDimensions", () => {
  test("no override returns the recipe as-is", () => {
    const out = effectiveDimensions([baseRecipe], { version: 1, gate: { mode: "advisory" } });
    expect(out[0]).toEqual({ ...baseRecipe });
  });

  test("config-level dimension overrides apply", () => {
    const out = effectiveDimensions([baseRecipe], {
      version: 1,
      gate: { mode: "absolute" },
      dimensions: { context: { weight: 25, threshold: 60, gating: true } },
    });
    expect(out[0]?.weight).toBe(25);
    expect(out[0]?.threshold).toBe(60);
    expect(out[0]?.gating).toBe(true);
  });

  test("disabled probe becomes zero-weight override", () => {
    const out = effectiveDimensions([baseRecipe], {
      version: 1,
      gate: { mode: "advisory" },
      dimensions: { context: { probes: { "docs.adr-presence": { disabled: true } } } },
    });
    expect(out[0]?.overrides).toEqual([{ probeId: "docs.adr-presence", weight: 0 }]);
  });

  test("project probe weight overrides a corpus-level override", () => {
    const recipe: DimensionRecipe = {
      ...baseRecipe,
      overrides: [{ probeId: "p1", weight: 1 }],
    };
    const out = effectiveDimensions([recipe], {
      version: 1,
      gate: { mode: "advisory" },
      dimensions: { context: { probes: { p1: { weight: 5 } } } },
    });
    expect(out[0]?.overrides).toEqual([{ probeId: "p1", weight: 5 }]);
  });
});
