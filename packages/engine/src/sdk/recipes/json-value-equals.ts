import { defineProbe } from "../define-probe.js";
import type { DimensionAssignment, Fixture, Probe, Tier } from "../types.js";

export type JsonValueEqualsRecipe = {
  id: string;
  version: string;
  dimensions: DimensionAssignment[];
  tier?: Tier;
  rationale: string;
  path: string;
  jsonPath: string;
  expected: unknown;
  fixtures?: Fixture[];
};

export function jsonValueEquals(spec: JsonValueEqualsRecipe): Probe {
  return defineProbe({
    id: spec.id,
    version: spec.version,
    dimensions: spec.dimensions,
    tier: spec.tier ?? "static",
    evidence: ["files"],
    rationale: spec.rationale,
    detect: async (ev) => {
      const raw = await ev.files.readText(spec.path);
      if (raw === undefined) return { kind: "na", reason: `${spec.path} not present` };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        return {
          kind: "error",
          error: `failed to parse ${spec.path} as JSON: ${(err as Error).message}`,
        };
      }
      const actual = pickJsonPath(parsed, spec.jsonPath);
      return { kind: "predicate", value: deepEquals(actual, spec.expected) };
    },
    score: { kind: "predicate", direction: "positive" },
    fixtures: spec.fixtures ?? [],
  });
}

function pickJsonPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    deepEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
