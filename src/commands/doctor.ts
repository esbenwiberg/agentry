import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCatalog, type CatalogEntry, type Layer } from "../catalog.js";

export interface DoctorOptions {
  cwd: string;
}

type Status = "installed" | "missing" | "partial";

interface Report {
  entry: CatalogEntry;
  status: Status;
  detected: string[];
  providedPresent: string[];
  providedMissing: string[];
}

const LAYER_ORDER: Layer[] = [
  "context",
  "conventions",
  "specs",
  "harness",
  "execution",
  "validation",
  "architecture",
];

const STATUS_GLYPH: Record<Status, string> = {
  installed: "✓",
  partial: "~",
  missing: "·",
};

export function runDoctor(options: DoctorOptions): number {
  const { entries, malformed } = loadCatalog();

  if (entries.length === 0 && malformed.length === 0) {
    console.log("No catalog entries to audit.");
    return 0;
  }

  const reports: Report[] = entries
    .filter((e) => !e.deprecated_by)
    .map((entry) => buildReport(entry, options.cwd));

  console.log(`agentry doctor — auditing ${options.cwd}`);
  console.log("");

  const grouped = groupByLayer(reports);
  for (const layer of LAYER_ORDER) {
    const inLayer = grouped.get(layer);
    if (!inLayer || inLayer.length === 0) continue;
    console.log(`[${layer}]`);
    for (const r of inLayer) {
      printReport(r);
    }
    console.log("");
  }

  const ungrouped = reports.filter((r) => r.entry.layers.length === 0);
  if (ungrouped.length > 0) {
    console.log("[uncategorized]");
    for (const r of ungrouped) printReport(r);
    console.log("");
  }

  const summary = summarise(reports);
  console.log(
    `summary: ${summary.installed} installed, ${summary.partial} partial, ${summary.missing} missing`,
  );

  if (malformed.length > 0) {
    console.warn("");
    console.warn(
      `${malformed.length} malformed catalog entr${malformed.length === 1 ? "y" : "ies"} skipped:`,
    );
    for (const m of malformed) {
      const tag = m.id ?? "(unparsed)";
      console.warn(`  - ${tag} [${m.sourceFile}]`);
      for (const err of m.errors) {
        console.warn(`      • ${err}`);
      }
    }
  }

  return 0;
}

function buildReport(entry: CatalogEntry, cwd: string): Report {
  const detected = entry.detect.any_of.filter((p) =>
    existsSync(resolve(cwd, p)),
  );
  const providedPresent: string[] = [];
  const providedMissing: string[] = [];
  for (const p of entry.provides) {
    if (existsSync(resolve(cwd, p.target))) {
      providedPresent.push(p.target);
    } else {
      providedMissing.push(p.target);
    }
  }

  let status: Status;
  if (detected.length === 0 && providedPresent.length === 0) {
    status = "missing";
  } else if (providedMissing.length === 0) {
    status = "installed";
  } else {
    status = "partial";
  }
  return { entry, status, detected, providedPresent, providedMissing };
}

function groupByLayer(reports: Report[]): Map<Layer, Report[]> {
  const map = new Map<Layer, Report[]>();
  for (const r of reports) {
    for (const layer of r.entry.layers) {
      const arr = map.get(layer) ?? [];
      arr.push(r);
      map.set(layer, arr);
    }
  }
  return map;
}

function printReport(r: Report): void {
  const glyph = STATUS_GLYPH[r.status];
  const head = `  ${glyph} ${r.entry.id.padEnd(16)} ${r.status}`;
  console.log(head);
  if (r.status === "partial") {
    for (const target of r.providedMissing) {
      console.log(`      missing: ${target}`);
    }
  }
}

function summarise(reports: Report[]): Record<Status, number> {
  const out: Record<Status, number> = {
    installed: 0,
    partial: 0,
    missing: 0,
  };
  for (const r of reports) out[r.status] += 1;
  return out;
}
