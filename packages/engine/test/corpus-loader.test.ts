import { describe, expect, test } from "vitest";
import { type CorpusModule, mergeCorpora } from "../src/loader/corpus.js";
import type { DimensionRecipe, Fixer, Probe } from "../src/sdk/types.js";

function probe(id: string, tag = "a"): Probe {
  return {
    id,
    version: "1.0.0",
    dimensions: [{ id: "context", weight: 1 }],
    tier: "static",
    evidence: [],
    rationale: tag,
    async detect() {
      return { kind: "predicate", value: true };
    },
    score: { kind: "predicate", direction: "positive" },
    fixtures: [],
  } as unknown as Probe;
}

function dim(id: string, tag = "a"): DimensionRecipe {
  return { id, label: tag, weight: 1 } as unknown as DimensionRecipe;
}

function fixer(probeId: string, mode: "static" | "llm" = "static", tag = "a"): Fixer {
  return {
    probeId,
    mode,
    describe: tag,
    async plan() {
      return null;
    },
  } as Fixer;
}

describe("mergeCorpora", () => {
  test("single corpus: passthrough, no overrides", () => {
    const mod: CorpusModule = {
      meta: { name: "default", version: "1.0.0" },
      probes: [probe("lint.clean")],
      dimensions: [dim("feedback")],
      fixers: [fixer("lint.clean")],
    };
    const out = mergeCorpora([{ pkg: "default", mod }]);
    expect(out.probes).toHaveLength(1);
    expect(out.dimensions).toHaveLength(1);
    expect(out.fixers).toHaveLength(1);
    expect(out.overrides).toEqual([]);
    expect(out.sources).toEqual([{ package: "default", version: "1.0.0" }]);
  });

  test("later corpus overrides earlier by probe id", () => {
    const a: CorpusModule = {
      meta: { version: "1.0.0" },
      probes: [probe("lint.clean", "from-a"), probe("build.clean", "from-a")],
      dimensions: [dim("feedback")],
    };
    const b: CorpusModule = {
      meta: { version: "0.1.0" },
      probes: [probe("lint.clean", "from-b")],
      dimensions: [dim("feedback")],
    };
    const out = mergeCorpora([
      { pkg: "@es/default", mod: a },
      { pkg: "@you/ruby", mod: b },
    ]);
    expect(out.probes.map((p) => p.id).sort()).toEqual(["build.clean", "lint.clean"]);
    const overridden = out.probes.find((p) => p.id === "lint.clean") as unknown as {
      rationale: string;
    };
    expect(overridden.rationale).toBe("from-b");
    expect(out.overrides).toEqual([
      { kind: "probe", id: "lint.clean", from: "@es/default", to: "@you/ruby" },
      { kind: "dimension", id: "feedback", from: "@es/default", to: "@you/ruby" },
    ]);
  });

  test("fixers key on probeId+mode — static and llm coexist", () => {
    const a: CorpusModule = {
      probes: [probe("lint.clean")],
      dimensions: [dim("feedback")],
      fixers: [fixer("lint.clean", "static", "a-static"), fixer("lint.clean", "llm", "a-llm")],
    };
    const b: CorpusModule = {
      probes: [probe("lint.clean")],
      dimensions: [dim("feedback")],
      fixers: [fixer("lint.clean", "static", "b-static")],
    };
    const out = mergeCorpora([
      { pkg: "a", mod: a },
      { pkg: "b", mod: b },
    ]);
    expect(out.fixers).toHaveLength(2);
    const staticFixer = out.fixers.find((f) => f.mode === "static");
    expect(staticFixer?.describe).toBe("b-static");
    const llmFixer = out.fixers.find((f) => f.mode === "llm");
    expect(llmFixer?.describe).toBe("a-llm");
    expect(out.overrides).toEqual([
      { kind: "probe", id: "lint.clean", from: "a", to: "b" },
      { kind: "dimension", id: "feedback", from: "a", to: "b" },
      { kind: "fixer", id: "lint.clean:static", from: "a", to: "b" },
    ]);
  });

  test("primary metadata comes from the first corpus", () => {
    const a: CorpusModule = {
      meta: { name: "@es/default", version: "1.0.0" },
      probes: [probe("x")],
      dimensions: [dim("d")],
    };
    const b: CorpusModule = {
      meta: { name: "@you/ruby", version: "0.1.0" },
      probes: [probe("y")],
      dimensions: [dim("e")],
    };
    const out = mergeCorpora([
      { pkg: "@es/default", mod: a },
      { pkg: "@you/ruby", mod: b },
    ]);
    expect(out.name).toBe("@es/default");
    expect(out.version).toBe("1.0.0");
    expect(out.sources).toEqual([
      { package: "@es/default", version: "1.0.0" },
      { package: "@you/ruby", version: "0.1.0" },
    ]);
  });
});
