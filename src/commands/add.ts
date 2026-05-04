import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCatalog, type CatalogEntry, type Provide } from "../catalog.js";
import { CONTENT_DIR } from "../paths.js";
import {
  ensureDirAndCopy,
  fileExists,
  filesIdentical,
  isGitRepo,
  isToolAvailable,
} from "../io.js";
import {
  emptyLockfile,
  findLockedEntry,
  mergeLockedProvides,
  readLockfile,
  sha256OfFile,
  upsertLockedEntry,
  writeLockfile,
  type LockedProvide,
  type Lockfile,
} from "../lockfile.js";
import { chooseConflictAction, confirm, isInteractive } from "../prompt.js";

export interface AddOptions {
  cwd: string;
  id: string;
  noClaude: boolean;
  noRecipe: boolean;
  nonInteractive: boolean;
  dryRun: boolean;
}

type Outcome =
  | "written"
  | "unchanged"
  | "skipped-exists"
  | "skipped-flavor"
  | "kept"
  | "overwritten"
  | "would-write"
  | "would-overwrite"
  | "would-prompt";

interface ProvideResult {
  provide: Provide;
  outcome: Outcome;
  reason?: string;
}

const GLYPH: Record<Outcome, string> = {
  written: "+",
  unchanged: "=",
  "skipped-exists": "·",
  "skipped-flavor": "·",
  kept: "·",
  overwritten: "~",
  "would-write": "+",
  "would-overwrite": "~",
  "would-prompt": "?",
};

export async function runAdd(opts: AddOptions): Promise<number> {
  const { entries, malformed } = loadCatalog();
  if (malformed.length > 0) {
    console.warn(
      `(warning: ${malformed.length} malformed catalog entr${
        malformed.length === 1 ? "y" : "ies"
      } skipped)`,
    );
  }

  const target = entries.find((e) => e.id === opts.id);
  if (!target) {
    console.error(`agentry add: unknown entry '${opts.id}'`);
    console.error(`Try 'agentry list' to see available entries.`);
    return 1;
  }

  if (target.requires.git && !isGitRepo(opts.cwd)) {
    console.error(
      `agentry add: '${opts.id}' requires a git repository at ${opts.cwd}`,
    );
    console.error(`Run 'git init' first, or pass a different target path.`);
    return 1;
  }

  const interactive = !opts.nonInteractive && isInteractive();
  const order = await resolvePlan(target, entries, opts, interactive);
  if (order === null) {
    console.error("agentry add: aborted");
    return 1;
  }

  const allResults: { entry: CatalogEntry; results: ProvideResult[] }[] = [];
  for (const entry of order) {
    console.log(`\nagentry add ${entry.id}${opts.dryRun ? " (dry-run)" : ""}`);
    const results = await installEntry(entry, opts, interactive);
    allResults.push({ entry, results });
  }

  console.log("");
  for (const { entry, results } of allResults) {
    console.log(`  ${entry.id}: ${summariseResults(results)}`);
    for (const tool of entry.requires.tools) {
      if (!isToolAvailable(tool)) {
        console.warn(
          `    note: '${tool}' not found on PATH — install for full functionality`,
        );
      }
    }
  }

  if (!opts.dryRun) {
    await recordInstalls(opts.cwd, allResults);
  }
  return 0;
}

const RECORDABLE: ReadonlySet<Outcome> = new Set<Outcome>([
  "written",
  "overwritten",
  "unchanged",
]);

async function recordInstalls(
  cwd: string,
  allResults: { entry: CatalogEntry; results: ProvideResult[] }[],
): Promise<void> {
  let lf: Lockfile = (await readLockfile(cwd)) ?? emptyLockfile();
  let touched = false;

  for (const { entry, results } of allResults) {
    const recordable = results.filter((r) => RECORDABLE.has(r.outcome));
    if (recordable.length === 0) continue;

    const fresh: LockedProvide[] = await Promise.all(
      recordable.map(async (r) => ({
        target: r.provide.target,
        source: r.provide.source,
        flavor: r.provide.flavor,
        checksum: await sha256OfFile(resolve(CONTENT_DIR, r.provide.source)),
      })),
    );

    const prior = findLockedEntry(lf, entry.id);
    const merged = mergeLockedProvides(prior?.provides, fresh);

    lf = upsertLockedEntry(lf, {
      id: entry.id,
      version: entry.version,
      installed_at: new Date().toISOString(),
      provides: merged,
    });
    touched = true;
  }

  if (touched) await writeLockfile(cwd, lf);
}

async function resolvePlan(
  target: CatalogEntry,
  all: CatalogEntry[],
  opts: AddOptions,
  interactive: boolean,
): Promise<CatalogEntry[] | null> {
  const byId = new Map(all.map((e) => [e.id, e]));
  const order: CatalogEntry[] = [];
  const seen = new Set<string>();

  async function visit(entry: CatalogEntry): Promise<boolean> {
    if (seen.has(entry.id)) return true;
    seen.add(entry.id);

    for (const depId of entry.requires.entries) {
      const dep = byId.get(depId);
      if (!dep) continue;
      if (isAlreadyInstalled(dep, opts.cwd)) continue;
      if (seen.has(depId)) continue;

      const proceed = interactive
        ? await confirm(
            `'${entry.id}' depends on '${depId}' (not installed). Install '${depId}' too?`,
            true,
          )
        : false;
      if (proceed) {
        const ok = await visit(dep);
        if (!ok) return false;
      } else {
        console.warn(
          `  warning: '${entry.id}' depends on '${depId}' (not installed). Run 'agentry add ${depId}' separately.`,
        );
      }
    }
    order.push(entry);
    return true;
  }

  const ok = await visit(target);
  return ok ? order : null;
}

function isAlreadyInstalled(entry: CatalogEntry, cwd: string): boolean {
  return entry.detect.any_of.some((p) => existsSync(resolve(cwd, p)));
}

async function installEntry(
  entry: CatalogEntry,
  opts: AddOptions,
  interactive: boolean,
): Promise<ProvideResult[]> {
  const results: ProvideResult[] = [];
  for (const provide of entry.provides) {
    const result = await installProvide(provide, opts, interactive);
    results.push(result);
    printProvideLine(result);
  }
  return results;
}

async function installProvide(
  p: Provide,
  opts: AddOptions,
  interactive: boolean,
): Promise<ProvideResult> {
  if (opts.noClaude && p.flavor === "claude") {
    return { provide: p, outcome: "skipped-flavor", reason: "--no-claude" };
  }
  if (opts.noRecipe && p.flavor === "agnostic") {
    return { provide: p, outcome: "skipped-flavor", reason: "--no-recipe" };
  }

  const src = resolve(CONTENT_DIR, p.source);
  const dest = resolve(opts.cwd, p.target);

  if (!existsSync(src)) {
    return {
      provide: p,
      outcome: "skipped-exists",
      reason: "source missing (catalog/content drift)",
    };
  }

  if (fileExists(dest)) {
    if (await filesIdentical(src, dest)) {
      return { provide: p, outcome: "unchanged" };
    }

    if (p.conflict === "skip-if-exists") {
      return { provide: p, outcome: "skipped-exists" };
    }
    if (p.conflict === "overwrite") {
      if (opts.dryRun) return { provide: p, outcome: "would-overwrite" };
      await ensureDirAndCopy(src, dest);
      return { provide: p, outcome: "overwritten" };
    }
    if (opts.dryRun) {
      return { provide: p, outcome: "would-prompt", reason: "differs" };
    }
    if (!interactive) {
      return {
        provide: p,
        outcome: "kept",
        reason: "non-interactive default",
      };
    }
    const action = await chooseConflictAction(p.target, src, dest);
    if (action === "overwrite") {
      await ensureDirAndCopy(src, dest);
      return { provide: p, outcome: "overwritten" };
    }
    return { provide: p, outcome: "kept" };
  }

  if (opts.dryRun) return { provide: p, outcome: "would-write" };
  await ensureDirAndCopy(src, dest);
  return { provide: p, outcome: "written" };
}

function printProvideLine(r: ProvideResult): void {
  const reason = r.reason ? ` (${r.reason})` : "";
  console.log(
    `  ${GLYPH[r.outcome]} ${r.provide.target.padEnd(50)} ${r.outcome}${reason}`,
  );
}

function summariseResults(results: ProvideResult[]): string {
  const counts = new Map<Outcome, number>();
  for (const r of results) {
    counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
