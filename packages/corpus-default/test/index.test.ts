import { describe, expect, test } from "vitest";
import { meta } from "../src/index.js";

describe("corpus-default", () => {
  test("exports meta with name and version", () => {
    expect(meta.name).toBe("@esbenwiberg/corpus-default");
    expect(meta.version).toBe("0.0.0");
  });
});
