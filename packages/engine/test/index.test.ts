import { describe, expect, test } from "vitest";
import { VERSION } from "../src/index.js";

describe("engine", () => {
  test("exports a version", () => {
    expect(VERSION).toBe("1.0.0");
  });
});
