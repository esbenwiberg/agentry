import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isToolAvailable } from "../io.js";
import { AGENTRY_VERSION } from "../version.js";
import type {
  Gatherer,
  GathererContext,
  GathererStatus,
  ScanManifest,
  ScanOptions,
  ScanResult,
} from "./types.js";
import { SCAN_BUNDLE_VERSION } from "./types.js";
import { bundleTimestamp, ensureBundleDir } from "./writer.js";

const PROBE_TOOLS = [
  "git",
  "gh",
  "node",
  "npm",
  "pnpm",
  "yarn",
  "tsc",
  "python",
  "python3",
  "pip",
  "pytest",
  "ruff",
  "mypy",
  "go",
  "cargo",
  "make",
  "just",
  "docker",
  "gitleaks",
  "trivy",
  "eslint",
  "prettier",
  "biome",
];

export async function runScan(
  opts: ScanOptions,
  gatherers: Gatherer[],
): Promise<ScanResult> {
  const ts = bundleTimestamp();
  const bundleDir = await ensureBundleDir(opts.cwd, ts);

  const toolAvailability: Record<string, boolean> = {};
  for (const t of PROBE_TOOLS) toolAvailability[t] = isToolAvailable(t);

  const ctx: GathererContext = {
    cwd: opts.cwd,
    bundleDir,
    options: opts,
    toolAvailability,
  };

  const statuses: GathererStatus[] = [];
  for (const gatherer of gatherers) {
    if (gatherer.shouldRun && !gatherer.shouldRun(ctx)) {
      statuses.push({
        name: gatherer.name,
        status: "skipped",
        durationMs: 0,
        reason: "not enabled",
        outputs: [],
      });
      continue;
    }
    const start = Date.now();
    try {
      const outputs = await gatherer.run(ctx);
      statuses.push({
        name: gatherer.name,
        status: "ok",
        durationMs: Date.now() - start,
        outputs,
      });
    } catch (err) {
      statuses.push({
        name: gatherer.name,
        status: "failed",
        durationMs: Date.now() - start,
        reason: (err as Error).message,
        outputs: [],
      });
    }
  }

  const manifest: ScanManifest = {
    version: SCAN_BUNDLE_VERSION,
    agentryVersion: AGENTRY_VERSION,
    scannedAt: new Date().toISOString(),
    cwd: opts.cwd,
    options: { fitness: opts.fitness, includeSource: opts.includeSource },
    gatherers: statuses,
    toolAvailability,
  };

  await writeFile(
    join(bundleDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  return { bundleDir, manifest };
}
