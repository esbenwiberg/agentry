import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GatherContext, GoModuleEvidence, GoModuleInfo } from "../../sdk/types.js";
import { listTrackedFiles } from "../../util/git.js";

const MODULE_LIMIT = 50;
const GO_MOD_REGEX = /(?:^|\/)go\.mod$/i;

const MODULE_DIRECTIVE = /^module\s+(\S+)/m;
const GO_DIRECTIVE = /^go\s+(\S+)/m;
const REQUIRE_BLOCK = /require\s*\(([\s\S]*?)\)/g;
const REQUIRE_SINGLE = /^require\s+(\S+)\s+(\S+)/gm;
const REQUIRE_LINE = /^\s*([^\s/]+\/[^\s]+|[^\s/]+)\s+(\S+)/;

const EMPTY: GoModuleEvidence = { present: false, modules: [] };

export const goModuleSubsystem = {
  async gather(ctx: GatherContext): Promise<GoModuleEvidence> {
    const paths = await listTrackedFiles(ctx.cwd);
    if (paths === null) return EMPTY;

    const modPaths = paths.filter((p) => GO_MOD_REGEX.test(p)).slice(0, MODULE_LIMIT);
    if (modPaths.length === 0) return EMPTY;

    const modules: GoModuleInfo[] = [];
    for (const p of modPaths) {
      const info = await readGoMod(ctx.cwd, p);
      if (info) modules.push(info);
    }
    return { present: modules.length > 0, modules };
  },
};

async function readGoMod(cwd: string, path: string): Promise<GoModuleInfo | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, path), "utf8");
  } catch {
    return null;
  }

  const info: GoModuleInfo = { path, dependencies: {} };
  const moduleMatch = MODULE_DIRECTIVE.exec(raw);
  if (moduleMatch?.[1]) info.modulePath = moduleMatch[1];
  const goMatch = GO_DIRECTIVE.exec(raw);
  if (goMatch?.[1]) info.goVersion = goMatch[1];

  for (const block of raw.matchAll(REQUIRE_BLOCK)) {
    const body = block[1] ?? "";
    for (const line of body.split("\n")) {
      const trimmed = line.split("//")[0]?.trim();
      if (!trimmed) continue;
      const m = REQUIRE_LINE.exec(trimmed);
      if (m?.[1] && m[2]) info.dependencies[m[1]] = m[2];
    }
  }
  for (const m of raw.matchAll(REQUIRE_SINGLE)) {
    if (m[1] && m[2]) info.dependencies[m[1]] = m[2];
  }

  return info;
}
