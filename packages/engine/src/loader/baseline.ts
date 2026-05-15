import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage } from "../util/error-message.js";
import { isObject } from "../util/is-object.js";
import type { CorpusPin } from "./config.js";

export type Baseline = {
  version: 1;
  acceptedAt: string;
  acceptedBy?: string;
  commit?: string;
  corpus: CorpusPin[];
  fitness: number | null;
  dimensions: Record<string, number | null>;
  probes: Record<string, number | null>;
};

export const BASELINE_FILENAME = "repofit-baseline.json";
export const BASELINE_SCHEMA_URL = "https://repofit.dev/schema/baseline.v1.json";

export async function loadBaseline(cwd: string): Promise<Baseline | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, BASELINE_FILENAME), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`failed to parse ${BASELINE_FILENAME}: ${errorMessage(err)}`);
  }

  return validateBaseline(parsed);
}

export async function writeBaseline(cwd: string, baseline: Baseline): Promise<void> {
  const path = join(cwd, BASELINE_FILENAME);
  const withSchema = { $schema: BASELINE_SCHEMA_URL, ...baseline };
  await writeFile(path, `${JSON.stringify(withSchema, null, 2)}\n`, "utf8");
}

export function validateBaseline(raw: unknown): Baseline {
  if (!isObject(raw)) throw baselineError("/", "must be an object");
  if (raw.version !== 1)
    throw baselineError("/version", `must be 1, got ${JSON.stringify(raw.version)}`);
  if (typeof raw.acceptedAt !== "string")
    throw baselineError("/acceptedAt", "must be an ISO timestamp string");
  if (!Array.isArray(raw.corpus)) throw baselineError("/corpus", "must be an array");

  const corpus: CorpusPin[] = raw.corpus.map((entry, i) => {
    if (!isObject(entry)) throw baselineError(`/corpus/${i}`, "must be an object");
    if (typeof entry.package !== "string")
      throw baselineError(`/corpus/${i}/package`, "must be a string");
    if (typeof entry.version !== "string")
      throw baselineError(`/corpus/${i}/version`, "must be a string");
    return { package: entry.package, version: entry.version };
  });

  const fitness = raw.fitness === null ? null : numberOrThrow(raw.fitness, "/fitness");
  const dimensions = numberMap(raw.dimensions, "/dimensions");
  const probes = numberMap(raw.probes, "/probes");

  const out: Baseline = {
    version: 1,
    acceptedAt: raw.acceptedAt,
    corpus,
    fitness,
    dimensions,
    probes,
  };
  if (typeof raw.acceptedBy === "string") out.acceptedBy = raw.acceptedBy;
  if (typeof raw.commit === "string") out.commit = raw.commit;
  return out;
}

function numberMap(raw: unknown, path: string): Record<string, number | null> {
  if (!isObject(raw)) throw baselineError(path, "must be an object");
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null) {
      out[k] = null;
    } else if (typeof v === "number") {
      out[k] = v;
    } else {
      throw baselineError(`${path}/${k}`, "must be a number or null");
    }
  }
  return out;
}

function numberOrThrow(raw: unknown, path: string): number {
  if (typeof raw !== "number") throw baselineError(path, "must be a number");
  return raw;
}

function baselineError(path: string, message: string): Error {
  return new Error(`${BASELINE_FILENAME}: ${path} ${message}`);
}
