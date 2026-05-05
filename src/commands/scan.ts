import { relative } from "node:path";
import { runScan } from "../scan/runner.js";
import type { Gatherer, ScanOptions } from "../scan/types.js";
import { structureGatherer } from "../scan/gatherers/structure.js";
import { gitGatherer } from "../scan/gatherers/git.js";
import { hygieneGatherer } from "../scan/gatherers/hygiene.js";
import { securityGatherer } from "../scan/gatherers/security.js";
import { agentReadinessGatherer } from "../scan/gatherers/agent-readiness.js";
import { docsGatherer } from "../scan/gatherers/docs.js";
import { fitnessGatherer } from "../scan/gatherers/fitness.js";
import { catalogGatherer } from "../scan/gatherers/catalog.js";

export interface ScanCliOptions {
  cwd: string;
  fitness: boolean;
  includeSource: boolean;
}

export const DEFAULT_GATHERERS: Gatherer[] = [
  structureGatherer,
  gitGatherer,
  hygieneGatherer,
  securityGatherer,
  agentReadinessGatherer,
  docsGatherer,
  fitnessGatherer,
  catalogGatherer,
];

export async function runScanCommand(
  options: ScanCliOptions,
  gatherers: Gatherer[] = DEFAULT_GATHERERS,
): Promise<number> {
  const scanOpts: ScanOptions = {
    cwd: options.cwd,
    fitness: options.fitness,
    includeSource: options.includeSource,
  };

  console.log(`agentry scan — ${options.cwd}`);
  if (!options.fitness) {
    console.log("(fitness skipped — pass without --no-fitness to execute build/test/lint)");
  } else {
    console.log("(fitness enabled — will execute build/test/typecheck/lint commands)");
  }
  console.log("");

  const { bundleDir, manifest } = await runScan(scanOpts, gatherers);

  const ok = manifest.gatherers.filter((g) => g.status === "ok").length;
  const skipped = manifest.gatherers.filter((g) => g.status === "skipped").length;
  const failed = manifest.gatherers.filter((g) => g.status === "failed").length;

  for (const g of manifest.gatherers) {
    const glyph = g.status === "ok" ? "✓" : g.status === "skipped" ? "·" : "✗";
    const tail =
      g.status === "ok"
        ? ` (${g.durationMs}ms, ${g.outputs.length} file${g.outputs.length === 1 ? "" : "s"})`
        : g.reason
          ? ` — ${g.reason}`
          : "";
    console.log(`  ${glyph} ${g.name.padEnd(18)}${tail}`);
  }

  console.log("");
  console.log(`bundle: ${relative(options.cwd, bundleDir) || bundleDir}`);
  console.log(`summary: ${ok} ok, ${skipped} skipped, ${failed} failed`);
  console.log("");
  console.log(`Next: agentry brief    # emits an agent prompt against this bundle`);

  return failed > 0 ? 1 : 0;
}
