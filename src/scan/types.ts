export interface ScanOptions {
  cwd: string;
  fitness: boolean;
  includeSource: boolean;
}

export interface GathererStatus {
  name: string;
  status: "ok" | "skipped" | "failed";
  durationMs: number;
  reason?: string;
  outputs: string[];
}

export interface ScanManifest {
  version: string;
  agentryVersion: string;
  scannedAt: string;
  cwd: string;
  options: { fitness: boolean; includeSource: boolean };
  gatherers: GathererStatus[];
  toolAvailability: Record<string, boolean>;
}

export interface ScanResult {
  bundleDir: string;
  manifest: ScanManifest;
}

export interface GathererContext {
  cwd: string;
  bundleDir: string;
  options: ScanOptions;
  toolAvailability: Record<string, boolean>;
}

export interface Gatherer {
  name: string;
  shouldRun?: (ctx: GathererContext) => boolean;
  run: (ctx: GathererContext) => Promise<string[]>;
}

export const SCAN_BUNDLE_VERSION = "1";
