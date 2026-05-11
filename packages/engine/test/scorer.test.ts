import { describe, expect, test } from "vitest";
import { score } from "../src/scorer/index.js";
import type { Band } from "../src/sdk/types.js";

describe("scorer (predicate)", () => {
  test("true with positive direction → 100", () => {
    expect(
      score({ kind: "predicate", value: true }, { kind: "predicate", direction: "positive" }),
    ).toBe(100);
  });

  test("false with positive direction → 0", () => {
    expect(
      score({ kind: "predicate", value: false }, { kind: "predicate", direction: "positive" }),
    ).toBe(0);
  });

  test("true with negative direction → 0", () => {
    expect(
      score({ kind: "predicate", value: true }, { kind: "predicate", direction: "negative" }),
    ).toBe(0);
  });

  test("false with negative direction → 100", () => {
    expect(
      score({ kind: "predicate", value: false }, { kind: "predicate", direction: "negative" }),
    ).toBe(100);
  });
});

describe("scorer (count)", () => {
  const bands: Band[] = [
    { upTo: 0, score: 100 },
    { upTo: 2, score: 80 },
    { upTo: 10, score: 40 },
    { score: 0 },
  ];

  test("value 0 → 100", () => {
    expect(
      score({ kind: "count", value: 0 }, { kind: "count", direction: "negative", bands }),
    ).toBe(100);
  });

  test("value 2 → 80 (inclusive band edge)", () => {
    expect(
      score({ kind: "count", value: 2 }, { kind: "count", direction: "negative", bands }),
    ).toBe(80);
  });

  test("value 3 → 40 (falls into next band)", () => {
    expect(
      score({ kind: "count", value: 3 }, { kind: "count", direction: "negative", bands }),
    ).toBe(40);
  });

  test("value beyond last upTo → fallback band 0", () => {
    expect(
      score({ kind: "count", value: 999 }, { kind: "count", direction: "negative", bands }),
    ).toBe(0);
  });

  test("missing fallback band throws", () => {
    expect(() =>
      score(
        { kind: "count", value: 999 },
        { kind: "count", direction: "negative", bands: [{ upTo: 10, score: 50 }] },
      ),
    ).toThrow(/fallback/);
  });
});

describe("scorer (magnitude)", () => {
  test("banded magnitude scores like count", () => {
    expect(
      score(
        { kind: "magnitude", value: 150, unit: "lines" },
        {
          kind: "magnitude",
          direction: "positive",
          bands: [{ upTo: 100, score: 50 }, { upTo: 500, score: 100 }, { score: 40 }],
        },
      ),
    ).toBe(100);
  });
});

describe("scorer (inventory)", () => {
  const config = {
    kind: "inventory" as const,
    severityWeights: { info: 0, warn: 1, error: 3 },
    bands: [{ upTo: 0, score: 100 }, { upTo: 1, score: 80 }, { upTo: 3, score: 50 }, { score: 0 }],
  };

  test("no items → 100", () => {
    expect(score({ kind: "inventory", items: [] }, config)).toBe(100);
  });

  test("one warn → weighted total 1 → 80", () => {
    expect(
      score(
        {
          kind: "inventory",
          items: [{ location: { path: "x" }, severity: "warn", message: "" }],
        },
        config,
      ),
    ).toBe(80);
  });

  test("one error (weight 3) → 50", () => {
    expect(
      score(
        {
          kind: "inventory",
          items: [{ location: { path: "x" }, severity: "error", message: "" }],
        },
        config,
      ),
    ).toBe(50);
  });

  test("info items are weight 0", () => {
    expect(
      score(
        {
          kind: "inventory",
          items: [
            { location: { path: "x" }, severity: "info", message: "" },
            { location: { path: "y" }, severity: "info", message: "" },
          ],
        },
        config,
      ),
    ).toBe(100);
  });
});

describe("scorer (distribution)", () => {
  const bands: Band[] = [{ upTo: 10, score: 100 }, { upTo: 50, score: 50 }, { score: 0 }];

  test("mean over samples", () => {
    expect(
      score(
        { kind: "distribution", samples: [1, 2, 3, 4, 5] },
        { kind: "distribution", stat: "mean", bands },
      ),
    ).toBe(100);
  });

  test("max over samples", () => {
    expect(
      score(
        { kind: "distribution", samples: [1, 5, 100] },
        { kind: "distribution", stat: "max", bands },
      ),
    ).toBe(0);
  });

  test("p95 interpolated", () => {
    expect(
      score(
        { kind: "distribution", samples: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { kind: "distribution", stat: "p95", bands },
      ),
    ).toBe(100);
  });

  test("median of odd-count sorted", () => {
    expect(
      score(
        { kind: "distribution", samples: [10, 30, 60, 90, 120] },
        { kind: "distribution", stat: "median", bands },
      ),
    ).toBe(0);
  });

  test("empty samples throws (detector should emit na)", () => {
    expect(() =>
      score({ kind: "distribution", samples: [] }, { kind: "distribution", stat: "mean", bands }),
    ).toThrow(/empty samples/);
  });
});

describe("scorer (na/error)", () => {
  test("na reading → null", () => {
    expect(
      score({ kind: "na", reason: "skipped" }, { kind: "predicate", direction: "positive" }),
    ).toBeNull();
  });

  test("error reading → null", () => {
    expect(
      score({ kind: "error", error: "boom" }, { kind: "predicate", direction: "positive" }),
    ).toBeNull();
  });
});

describe("scorer (mismatch)", () => {
  test("predicate reading + count config → throws", () => {
    expect(() =>
      score(
        { kind: "predicate", value: true },
        { kind: "count", direction: "positive", bands: [{ score: 100 }] },
      ),
    ).toThrow(/mismatch/);
  });
});
