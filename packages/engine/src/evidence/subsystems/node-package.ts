import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GatherContext, NodePackageEvidence } from "../../sdk/types.js";

const EMPTY: NodePackageEvidence = {
  present: false,
  dependencies: {},
  devDependencies: {},
  scripts: {},
  raw: null,
};

export const nodePackageSubsystem = {
  async gather(ctx: GatherContext): Promise<NodePackageEvidence> {
    let raw: string;
    try {
      raw = await readFile(join(ctx.cwd, "package.json"), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY;
      throw err;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return EMPTY;
    }

    return {
      present: true,
      dependencies: stringRecord(parsed.dependencies),
      devDependencies: stringRecord(parsed.devDependencies),
      scripts: stringRecord(parsed.scripts),
      raw: parsed,
    };
  },
};

function stringRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
