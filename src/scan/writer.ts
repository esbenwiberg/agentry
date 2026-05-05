import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

export const SCAN_DIR_NAME = ".agentry";
export const SCAN_SUBDIR = "scan";

export function bundleTimestamp(now: Date = new Date()): string {
  return now.toISOString().replace(/[:]/g, "-").replace(/\.\d+Z$/, "Z");
}

export function bundleRoot(cwd: string): string {
  return resolve(cwd, SCAN_DIR_NAME, SCAN_SUBDIR);
}

export async function ensureBundleDir(cwd: string, ts: string): Promise<string> {
  const dir = join(bundleRoot(cwd), ts);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function findLatestBundle(cwd: string): Promise<string | null> {
  const root = bundleRoot(cwd);
  let dirs: string[];
  try {
    dirs = await readdir(root);
  } catch {
    return null;
  }
  const sorted = dirs.filter((d) => /^\d{4}-/.test(d)).sort();
  if (sorted.length === 0) return null;
  return join(root, sorted[sorted.length - 1]!);
}
