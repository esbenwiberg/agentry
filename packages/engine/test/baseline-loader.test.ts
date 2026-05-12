import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  BASELINE_FILENAME,
  type Baseline,
  loadBaseline,
  validateBaseline,
  writeBaseline,
} from "../src/loader/baseline.js";

describe("baseline loader", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("missing baseline → null", async () => {
    expect(await loadBaseline(tmp)).toBeNull();
  });

  test("round-trip write/read", async () => {
    const baseline: Baseline = {
      version: 1,
      acceptedAt: "2026-05-11T12:00:00Z",
      acceptedBy: "dev@example.com",
      commit: "abc1234",
      corpus: [{ package: "@esbenwiberg/corpus-default", version: "0.0.0" }],
      fitness: 84,
      dimensions: { context: 70, safety: 100, latency: null },
      probes: { "agent.guidance-present": 100, "docs.readme-present": 100 },
    };

    await writeBaseline(tmp, baseline);
    const loaded = await loadBaseline(tmp);
    expect(loaded).toEqual(baseline);
  });

  test("written file is JSON with trailing newline", async () => {
    const baseline: Baseline = {
      version: 1,
      acceptedAt: "2026-05-11T12:00:00Z",
      corpus: [{ package: "x", version: "0.0.0" }],
      fitness: null,
      dimensions: {},
      probes: {},
    };
    await writeBaseline(tmp, baseline);
    const raw = readFileSync(join(tmp, BASELINE_FILENAME), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual(baseline);
  });

  test("rejects wrong version", () => {
    expect(() =>
      validateBaseline({ version: 2, acceptedAt: "x", corpus: [], dimensions: {}, probes: {} }),
    ).toThrow(/version/);
  });

  test("rejects malformed dimensions map", () => {
    expect(() =>
      validateBaseline({
        version: 1,
        acceptedAt: "x",
        corpus: [],
        fitness: null,
        dimensions: { context: "high" },
        probes: {},
      }),
    ).toThrow(/dimensions\/context/);
  });
});
