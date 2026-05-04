import { describe, expect, it } from "vitest";
import { isString, isStringArray, pickString } from "../../src/typeguards.js";

describe("isString", () => {
  it("returns true for strings", () => {
    expect(isString("")).toBe(true);
    expect(isString("hello")).toBe(true);
  });

  it("returns false for non-strings", () => {
    expect(isString(0)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString([])).toBe(false);
    expect(isString(true)).toBe(false);
  });
});

describe("isStringArray", () => {
  it("returns true for arrays of strings", () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(["a"])).toBe(true);
    expect(isStringArray(["a", "b", "c"])).toBe(true);
  });

  it("returns false for non-arrays", () => {
    expect(isStringArray("a")).toBe(false);
    expect(isStringArray(null)).toBe(false);
    expect(isStringArray({ 0: "a", length: 1 })).toBe(false);
  });

  it("returns false for arrays containing non-strings", () => {
    expect(isStringArray(["a", 1])).toBe(false);
    expect(isStringArray([null])).toBe(false);
    expect(isStringArray(["a", undefined])).toBe(false);
  });
});

describe("pickString", () => {
  it("returns the string value when key holds a string", () => {
    expect(pickString({ name: "agentry" }, "name")).toBe("agentry");
  });

  it("returns the fallback when key is missing", () => {
    expect(pickString({}, "name", "default")).toBe("default");
  });

  it("returns the fallback when value is not a string", () => {
    expect(pickString({ name: 42 }, "name", "default")).toBe("default");
    expect(pickString({ name: null }, "name", "default")).toBe("default");
  });

  it("defaults the fallback to empty string", () => {
    expect(pickString({}, "name")).toBe("");
  });
});
