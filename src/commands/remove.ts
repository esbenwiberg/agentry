import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import {
  findLockedEntry,
  readLockfile,
  removeLockedEntry,
  sha256OfFile,
  upsertLockedEntry,
  writeLockfile,
  type LockedEntry,
  type LockedProvide,
  type Lockfile,
} from "../lockfile.js";
import { confirm, isInteractive } from "../prompt.js";

export interface RemoveOptions {
  cwd: string;
  id: string;
  dryRun: boolean;
  force: boolean;
  nonInteractive: boolean;
}

type Outcome = "delete-clean" | "delete-user-edit" | "keep-user-edit" | "already-gone";

interface ProvideOutcome {
  provide: LockedProvide;
  outcome: Outcome;
}

const GLYPH: Record<Outcome, string> = {
  "delete-clean": "-",
  "delete-user-edit": "!",
  "keep-user-edit": "·",
  "already-gone": " ",
};

export async function runRemove(opts: RemoveOptions): Promise<number> {
  const lf = await readLockfile(opts.cwd);
  if (lf === null) {
    console.error(
      "agentry remove: no agentry.lock.toml — nothing to remove.",
    );
    return 1;
  }

  const locked = findLockedEntry(lf, opts.id);
  if (!locked) {
    console.error(`agentry remove: '${opts.id}' is not installed.`);
    return 1;
  }

  const outcomes = await Promise.all(
    locked.provides.map((p) => classify(p, opts.cwd, opts.force)),
  );

  console.log(`agentry remove ${opts.id}${opts.dryRun ? " (dry-run)" : ""}`);
  for (const o of outcomes) {
    console.log(
      `  ${GLYPH[o.outcome]} ${o.provide.target.padEnd(50)} ${o.outcome}`,
    );
  }

  const skipped = outcomes.filter((o) => o.outcome === "keep-user-edit");
  if (skipped.length > 0 && !opts.force) {
    console.log(
      `\n  ${skipped.length} user-edited file${skipped.length === 1 ? "" : "s"} kept. Use --force to delete.`,
    );
  }

  if (opts.dryRun) return 0;

  const interactive = !opts.nonInteractive && isInteractive();
  if (interactive && !(await confirm("\nProceed?", false))) {
    console.log("aborted.");
    return 0;
  }

  const updatedLf = await applyRemoval(locked, outcomes, opts.cwd, lf);
  await writeLockfile(opts.cwd, updatedLf);
  console.log("\nremove complete.");
  return 0;
}

async function classify(
  provide: LockedProvide,
  cwd: string,
  force: boolean,
): Promise<ProvideOutcome> {
  const dest = resolve(cwd, provide.target);
  if (!existsSync(dest)) return { provide, outcome: "already-gone" };
  const destHash = await sha256OfFile(dest);
  if (destHash === provide.checksum) {
    return { provide, outcome: "delete-clean" };
  }
  return {
    provide,
    outcome: force ? "delete-user-edit" : "keep-user-edit",
  };
}

async function applyRemoval(
  locked: LockedEntry,
  outcomes: ProvideOutcome[],
  cwd: string,
  lf: Lockfile,
): Promise<Lockfile> {
  const kept: LockedProvide[] = [];
  for (const o of outcomes) {
    if (o.outcome === "keep-user-edit") {
      kept.push(o.provide);
      continue;
    }
    if (o.outcome === "already-gone") continue;
    await unlink(resolve(cwd, o.provide.target));
  }

  if (kept.length === 0) {
    return removeLockedEntry(lf, locked.id);
  }
  return upsertLockedEntry(lf, {
    id: locked.id,
    version: locked.version,
    installed_at: locked.installed_at,
    provides: kept,
  });
}
