import { describe, expect, test } from "vitest";
import { CORPUS_VERSION } from "../src/index.js";

describe("corpus-default", () => {
  test("exports a corpus version", () => {
    expect(CORPUS_VERSION).toBe("0.0.0");
  });
});
