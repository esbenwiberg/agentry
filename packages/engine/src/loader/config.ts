import { readFileSync } from "node:fs";
import { join } from "node:path";

// Skeleton config — Phase 1 only loads if present, validates nothing,
// and ignores most fields. Phase 3 makes this real.
export type ProjectConfig = {
  corpus?: string;
};

export const CONFIG_FILENAME = "repofit.config.json";

export function loadProjectConfig(cwd: string): ProjectConfig | null {
  const path = join(cwd, CONFIG_FILENAME);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  try {
    return JSON.parse(raw) as ProjectConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to parse ${CONFIG_FILENAME}: ${message}`);
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
