import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCatalog, type CatalogEntry, type Layer } from "../catalog.js";
import { CONTENT_DIR } from "../paths.js";
import { filesIdentical, isToolAvailable } from "../io.js";

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
  providedDrifted: string[];
  missingTools: string[];
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

export async function runDoctor(options: DoctorOptions): Promise<number> {
  const { entries, malformed } = loadCatalog();

  if (entries.length === 0 && malformed.length === 0) {
    console.log("No catalog entries to audit.");
    return 0;
  }

  const reports = await Promise.all(
    entries
      .filter((e) => !e.deprecated_by)
      .map((entry) => buildReport(entry, options.cwd)),
  );

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
  const tail: string[] = [];
  if (summary.drifted > 0) tail.push(`${summary.drifted} drifted`);
  if (summary.toolGaps > 0) {
    tail.push(`${summary.toolGaps} tool gap${summary.toolGaps === 1 ? "" : "s"}`);
  }
  const tailStr = tail.length > 0 ? `; ${tail.join(", ")}` : "";
  console.log(
    `summary: ${summary.installed} installed, ${summary.partial} partial, ${summary.missing} missing${tailStr}`,
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

async function buildReport(
  entry: CatalogEntry,
  cwd: string,
): Promise<Report> {
  const detected = entry.detect.any_of.filter((p) =>
    existsSync(resolve(cwd, p)),
  );

  const providedPresent: string[] = [];
  const providedMissing: string[] = [];
  const driftChecks: Promise<{ target: string; drifted: boolean } | null>[] =
    [];

  for (const p of entry.provides) {
    const dest = resolve(cwd, p.target);
    if (existsSync(dest)) {
      providedPresent.push(p.target);
      const src = resolve(CONTENT_DIR, p.source);
      driftChecks.push(
        existsSync(src)
          ? filesIdentical(src, dest).then((same) => ({
              target: p.target,
              drifted: !same,
            }))
          : Promise.resolve(null),
      );
    } else {
      providedMissing.push(p.target);
    }
  }

  const driftResults = await Promise.all(driftChecks);
  const providedDrifted = driftResults
    .filter((r): r is { target: string; drifted: boolean } =>
      Boolean(r && r.drifted),
    )
    .map((r) => r.target);

  const missingTools = entry.requires.tools.filter((t) => !isToolAvailable(t));

  let status: Status;
  if (detected.length === 0 && providedPresent.length === 0) {
    status = "missing";
  } else if (providedMissing.length === 0) {
    status = "installed";
  } else {
    status = "partial";
  }
  return {
    entry,
    status,
    detected,
    providedPresent,
    providedMissing,
    providedDrifted,
    missingTools,
  };
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
  const flags: string[] = [];
  if (r.providedDrifted.length > 0) {
    flags.push(`${r.providedDrifted.length} drifted`);
  }
  if (r.missingTools.length > 0) {
    flags.push(`tool gap: ${r.missingTools.join(",")}`);
  }
  const flagStr = flags.length > 0 ? ` (${flags.join("; ")})` : "";
  console.log(`  ${glyph} ${r.entry.id.padEnd(16)} ${r.status}${flagStr}`);
  for (const target of r.providedMissing) {
    console.log(`      missing: ${target}`);
  }
  for (const target of r.providedDrifted) {
    console.log(`      drifted: ${target}`);
  }
}

interface Summary {
  installed: number;
  partial: number;
  missing: number;
  drifted: number;
  toolGaps: number;
}

function summarise(reports: Report[]): Summary {
  const out: Summary = {
    installed: 0,
    partial: 0,
    missing: 0,
    drifted: 0,
    toolGaps: 0,
  };
  for (const r of reports) {
    out[r.status] += 1;
    if (r.providedDrifted.length > 0) out.drifted += 1;
    if (r.missingTools.length > 0) out.toolGaps += 1;
  }
  return out;
}
