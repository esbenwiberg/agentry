import { describe, expect, test } from "vitest";
import { score } from "../src/scorer/index.js";

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

  test("count reading is not implemented yet", () => {
    expect(() =>
      score(
        { kind: "count", value: 0 },
        { kind: "count", direction: "positive", bands: [{ score: 100 }] },
      ),
    ).toThrow(/not implemented/);
  });
});
