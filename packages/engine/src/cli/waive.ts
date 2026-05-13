import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONFIG_FILENAME } from "../loader/config.js";

export type WaiveAddOptions = {
  cwd: string;
  probeId: string;
  location: string;
  reason: string;
  expires?: string;
};

export type WaiveLsOptions = {
  cwd: string;
};

export type WaiveRmOptions = {
  cwd: string;
  hash: string;
};

type WaiverEntry = {
  probeId: string;
  location: string;
  reason: string;
  expires?: string;
};

type ConfigShape = {
  waivers?: WaiverEntry[];
  [key: string]: unknown;
};

export function findingHash(probeId: string, location: string): string {
  // Stable 12-char fingerprint for CLI listing/removal. Not cryptographic —
  // it just needs to be short, stable, and collision-resistant within a repo.
  const input = `${probeId}|${location}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = (h2 >>> 0).toString(16).padStart(8, "0");
  const lo = (h1 >>> 0).toString(16).padStart(8, "0");
  return `${hi}${lo}`.slice(0, 12);
}

export async function waiveAdd(
  opts: WaiveAddOptions,
): Promise<{ stdout: string; exitCode: number }> {
  if (opts.reason.trim().length === 0) {
    return {
      stdout: "repofit: --reason must be non-empty (waivers require a stated reason).\n",
      exitCode: 2,
    };
  }
  if (opts.expires !== undefined && !isIsoDate(opts.expires)) {
    return {
      stdout: `repofit: --expires must be an ISO date (YYYY-MM-DD), got '${opts.expires}'.\n`,
      exitCode: 2,
    };
  }

  const configPath = path.join(opts.cwd, CONFIG_FILENAME);
  const config = await readConfig(configPath);
  const waivers = config.waivers ?? [];

  const existing = waivers.find((w) => w.probeId === opts.probeId && w.location === opts.location);
  if (existing) {
    return {
      stdout: [
        `repofit: a waiver already exists for ${opts.probeId} @ ${opts.location}.`,
        `         reason: ${existing.reason}`,
        "         remove it first with `repofit waive rm <hash>`.",
        "",
      ].join("\n"),
      exitCode: 2,
    };
  }

  const entry: WaiverEntry = {
    probeId: opts.probeId,
    location: opts.location,
    reason: opts.reason,
    ...(opts.expires ? { expires: opts.expires } : {}),
  };
  waivers.push(entry);
  config.waivers = waivers;
  await writeConfig(configPath, config);

  const hash = findingHash(opts.probeId, opts.location);
  return {
    stdout: [
      `waived  ${opts.probeId}  ${opts.location}  (${hash})`,
      `reason  ${opts.reason}`,
      ...(opts.expires ? [`expires ${opts.expires}`] : []),
      "",
    ].join("\n"),
    exitCode: 0,
  };
}

export async function waiveLs(opts: WaiveLsOptions): Promise<{ stdout: string; exitCode: number }> {
  const configPath = path.join(opts.cwd, CONFIG_FILENAME);
  const config = await readConfig(configPath);
  const waivers = config.waivers ?? [];

  if (waivers.length === 0) {
    return { stdout: "no waivers configured.\n", exitCode: 0 };
  }

  const lines: string[] = [];
  for (const w of waivers) {
    const hash = findingHash(w.probeId, w.location);
    lines.push(`${hash}  ${w.probeId}  ${w.location}`);
    lines.push(`            ${w.reason}${w.expires ? `  (expires ${w.expires})` : ""}`);
  }
  lines.push("");
  return { stdout: lines.join("\n"), exitCode: 0 };
}

export async function waiveRm(opts: WaiveRmOptions): Promise<{ stdout: string; exitCode: number }> {
  const configPath = path.join(opts.cwd, CONFIG_FILENAME);
  const config = await readConfig(configPath);
  const waivers = config.waivers ?? [];

  const idx = waivers.findIndex((w) => findingHash(w.probeId, w.location) === opts.hash);
  if (idx === -1) {
    return {
      stdout: `repofit: no waiver with hash '${opts.hash}'. Run 'repofit waive ls' to see hashes.\n`,
      exitCode: 2,
    };
  }

  const removed = waivers[idx];
  waivers.splice(idx, 1);
  if (!removed) {
    return {
      stdout: `repofit: internal error: waiver index ${idx} out of range.\n`,
      exitCode: 2,
    };
  }
  if (waivers.length === 0) delete config.waivers;
  else config.waivers = waivers;
  await writeConfig(configPath, config);
  return {
    stdout: `removed waiver  ${opts.hash}  ${removed.probeId}  ${removed.location}\n`,
    exitCode: 0,
  };
}

async function readConfig(configPath: string): Promise<ConfigShape> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${CONFIG_FILENAME} not found. Run 'repofit --init' first.`);
    }
    throw err;
  }
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${CONFIG_FILENAME} must contain a JSON object at the top level.`);
  }
  return parsed as ConfigShape;
}

async function writeConfig(configPath: string, config: ConfigShape): Promise<void> {
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
