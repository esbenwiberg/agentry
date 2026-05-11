import { describe, expect, test } from "vitest";
import { VERSION } from "../src/index.js";

describe("engine", () => {
  test("exports a version", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
