import { describe, expect, test } from "vitest";
import { runFixture } from "../src/fixtures/runner.js";
import { fileAbsent } from "../src/sdk/recipes/file-absent.js";
import { fileExists } from "../src/sdk/recipes/file-exists.js";
import { jsonValueEquals } from "../src/sdk/recipes/json-value-equals.js";

const base = {
  id: "x.probe",
  version: "0.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  rationale: "test",
};

describe("fileExists recipe", () => {
  const probe = fileExists({ ...base, path: "README.md" });

  test("defaults: static tier, files evidence, predicate scoring", () => {
    expect(probe.tier).toBe("static");
    expect(probe.evidence).toEqual(["files"]);
    expect(probe.score).toEqual({ kind: "predicate", direction: "positive" });
  });

  test("auto-generated fixtures pass", async () => {
    for (const fx of probe.fixtures) {
      const outcome = await runFixture(probe, fx);
      if (!outcome.ok) throw new Error(outcome.reason);
    }
  });
});

describe("fileAbsent recipe", () => {
  const probe = fileAbsent({ ...base, path: "CHANGELOG.md" });

  test("scores negative (absent is good)", () => {
    expect(probe.score).toEqual({ kind: "predicate", direction: "negative" });
  });

  test("auto-generated fixtures pass", async () => {
    for (const fx of probe.fixtures) {
      const outcome = await runFixture(probe, fx);
      if (!outcome.ok) throw new Error(outcome.reason);
    }
  });
});

describe("jsonValueEquals recipe", () => {
  const probe = jsonValueEquals({
    ...base,
    path: "package.json",
    jsonPath: "type",
    expected: "module",
    fixtures: [
      {
        name: "matches",
        evidence: { files: { "package.json": JSON.stringify({ type: "module" }) } },
        expect: { reading: { kind: "predicate", value: true }, score: 100 },
      },
      {
        name: "mismatches",
        evidence: { files: { "package.json": JSON.stringify({ type: "commonjs" }) } },
        expect: { reading: { kind: "predicate", value: false }, score: 0 },
      },
      {
        name: "missing-file",
        evidence: { files: [] },
        expect: { reading: { kind: "na", reason: "package.json not present" }, score: null },
      },
      {
        name: "malformed-json",
        evidence: { files: { "package.json": "{not json" } },
        expect: {
          reading: {
            kind: "error",
            error:
              "failed to parse package.json as JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
          },
          score: null,
        },
      },
    ],
  });

  test("all fixtures pass", async () => {
    for (const fx of probe.fixtures) {
      const outcome = await runFixture(probe, fx);
      if (!outcome.ok) throw new Error(`${fx.name}: ${outcome.reason}`);
    }
  });

  test("nested json path", async () => {
    const nested = jsonValueEquals({
      ...base,
      path: "package.json",
      jsonPath: "engines.node",
      expected: ">=22",
    });
    const outcome = await runFixture(nested, {
      name: "nested",
      evidence: { files: { "package.json": JSON.stringify({ engines: { node: ">=22" } }) } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    });
    expect(outcome.ok).toBe(true);
  });

  test("missing nested key → false (not error)", async () => {
    const probe2 = jsonValueEquals({
      ...base,
      path: "package.json",
      jsonPath: "engines.node",
      expected: ">=22",
    });
    const outcome = await runFixture(probe2, {
      name: "missing-key",
      evidence: { files: { "package.json": "{}" } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    });
    expect(outcome.ok).toBe(true);
  });
});
