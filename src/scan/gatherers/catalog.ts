import { mkdir, copyFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";
import { loadMergedCatalog } from "../../merged-catalog.js";
import { activeEntries, isPractice } from "../../catalog.js";

interface CatalogSnapshotEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  kind: "practice" | "artifact";
  layers: string[];
  overlay?: string;
  /** Bundle-relative path to inlined practice markdown (only for kind=practice). */
  practiceFile?: string;
  provideTargets: string[];
  requiresEntries: string[];
}

export const catalogGatherer: Gatherer = {
  name: "catalog",
  async run(ctx: GathererContext): Promise<string[]> {
    const merged = loadMergedCatalog(ctx.cwd);
    const active = activeEntries(merged.entries);
    const outputs: string[] = [];

    const practicesDir = join(ctx.bundleDir, "practices");
    let practicesDirCreated = false;

    const snapshot: CatalogSnapshotEntry[] = [];
    for (const e of active) {
      const entry: CatalogSnapshotEntry = {
        id: e.id,
        name: e.name,
        description: e.description,
        version: e.version,
        kind: e.kind,
        layers: [...e.layers],
        ...(e.overlay ? { overlay: e.overlay } : {}),
        provideTargets: e.provides.map((p) => p.target),
        requiresEntries: e.requires.entries,
      };

      if (isPractice(e) && e.practice) {
        if (!practicesDirCreated) {
          await mkdir(practicesDir, { recursive: true });
          practicesDirCreated = true;
        }
        const dest = join(practicesDir, `${e.id}.md`);
        await copyFile(resolve(e.sourceRoot, e.practice), dest);
        entry.practiceFile = `practices/${e.id}.md`;
        outputs.push(`practices/${e.id}.md`);
      }

      snapshot.push(entry);
    }

    const overlays = merged.registeredOverlays.map((o) => ({
      registrationId: o.registrationId,
      manifestId: o.manifest.id,
      version: o.manifest.version,
      description: o.manifest.description,
      rootDir: o.rootDir,
    }));

    await writeFile(
      join(ctx.bundleDir, "catalog.json"),
      JSON.stringify(
        {
          entries: snapshot,
          overlays,
          shadowedEntryCount: merged.shadowed.length,
          malformedCount: merged.malformed.length,
          overlayLoadErrorCount: merged.overlayLoadErrors.length,
        },
        null,
        2,
      ),
    );
    outputs.unshift("catalog.json");
    return outputs;
  },
};
