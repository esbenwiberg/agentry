import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadCatalog, type CatalogEntry, type Provide } from "../catalog.js";
import { CONTENT_DIR } from "../paths.js";
import { ensureDirAndCopy, filesIdentical } from "../io.js";
import {
  findLockedEntry,
  findLockedProvide,
  mergeLockedProvides,
  readLockfile,
  sha256OfFile,
  upsertLockedEntry,
  writeLockfile,
  type Lockfile,
  type LockedEntry,
  type LockedProvide,
} from "../lockfile.js";
import { confirm, isInteractive } from "../prompt.js";

export interface UpgradeOptions {
  cwd: string;
  id: string | undefined;
  dryRun: boolean;
  force: boolean;
  nonInteractive: boolean;
}

type Action =
  | "refresh-out-of-date"
  | "force-user-edit"
  | "keep-user-edit"
  | "write-missing";

const GLYPH: Record<Action, string> = {
  "refresh-out-of-date": "~",
  "force-user-edit": "!",
  "keep-user-edit": "·",
  "write-missing": "+",
};

interface ProvideAction {
  provide: Provide;
  action: Action;
}

interface EntryPlan {
  entry: CatalogEntry;
  locked: LockedEntry;
  reasons: string[];
  actions: ProvideAction[];
}

export async function runUpgrade(opts: UpgradeOptions): Promise<number> {
  const lf = await readLockfile(opts.cwd);
  if (lf === null) {
    console.error(
      "agentry upgrade: no agentry.lock.toml — nothing to upgrade.",
    );
    console.error("Hint: run 'agentry add <id>' first to install entries.");
    return 1;
  }

  const { entries } = loadCatalog();
  const allPlans = await Promise.all(
    entries
      .filter((e) => !e.deprecated_by)
      .map((e) => buildPlan(e, lf, opts.cwd, opts.force)),
  );
  let plans = allPlans.filter((p): p is EntryPlan => p !== null);

  if (opts.id) {
    plans = plans.filter((p) => p.entry.id === opts.id);
    if (plans.length === 0) {
      console.error(
        `agentry upgrade: '${opts.id}' is not stale, not installed, or unknown.`,
      );
      return 1;
    }
  }

  if (plans.length === 0) {
    console.log("agentry upgrade: nothing to upgrade — all entries current.");
    return 0;
  }

  console.log(`agentry upgrade${opts.dryRun ? " (dry-run)" : ""}`);
  for (const p of plans) {
    console.log(`\n  ${p.entry.id} — ${p.reasons.join(", ")}`);
    for (const a of p.actions) {
      console.log(
        `    ${GLYPH[a.action]} ${a.provide.target.padEnd(50)} ${a.action}`,
      );
    }
  }

  if (opts.dryRun) return 0;

  const interactive = !opts.nonInteractive && isInteractive();
  if (interactive && !(await confirm("\nProceed?", true))) {
    console.log("aborted.");
    return 0;
  }

  let updatedLf: Lockfile = lf;
  for (const plan of plans) {
    updatedLf = await applyPlan(plan, opts.cwd, updatedLf);
  }
  await writeLockfile(opts.cwd, updatedLf);
  console.log("\nupgrade complete.");
  return 0;
}

async function buildPlan(
  entry: CatalogEntry,
  lf: Lockfile,
  cwd: string,
  force: boolean,
): Promise<EntryPlan | null> {
  const locked = findLockedEntry(lf, entry.id);
  if (!locked) return null;

  const actions: ProvideAction[] = [];
  for (const provide of entry.provides) {
    const dest = resolve(cwd, provide.target);
    const src = resolve(CONTENT_DIR, provide.source);
    if (!existsSync(src)) continue;

    if (!existsSync(dest)) {
      actions.push({ provide, action: "write-missing" });
      continue;
    }
    if (await filesIdentical(src, dest)) continue;

    const lockedP = findLockedProvide(locked, provide.target);
    if (lockedP) {
      const destHash = await sha256OfFile(dest);
      if (destHash === lockedP.checksum) {
        actions.push({ provide, action: "refresh-out-of-date" });
        continue;
      }
    }
    actions.push({
      provide,
      action: force ? "force-user-edit" : "keep-user-edit",
    });
  }

  const versionDrift = locked.version !== entry.version;
  if (actions.length === 0 && !versionDrift) return null;

  const reasons: string[] = [];
  if (versionDrift) reasons.push(`v${locked.version}→${entry.version}`);
  const refresh = actions.filter((a) => a.action === "refresh-out-of-date").length;
  const userEdits = actions.filter((a) => a.action !== "refresh-out-of-date" && a.action !== "write-missing").length;
  const missing = actions.filter((a) => a.action === "write-missing").length;
  if (refresh > 0) reasons.push(`${refresh} out-of-date`);
  if (userEdits > 0) reasons.push(`${userEdits} user-edit${userEdits === 1 ? "" : "s"}`);
  if (missing > 0) reasons.push(`${missing} missing`);
  if (reasons.length === 0) reasons.push("metadata only");

  return { entry, locked, reasons, actions };
}

async function applyPlan(
  plan: EntryPlan,
  cwd: string,
  lf: Lockfile,
): Promise<Lockfile> {
  const fresh: LockedProvide[] = [];
  for (const a of plan.actions) {
    const src = resolve(CONTENT_DIR, a.provide.source);
    const dest = resolve(cwd, a.provide.target);

    if (
      a.action === "refresh-out-of-date" ||
      a.action === "force-user-edit" ||
      a.action === "write-missing"
    ) {
      await ensureDirAndCopy(src, dest);
      fresh.push({
        target: a.provide.target,
        source: a.provide.source,
        flavor: a.provide.flavor,
        checksum: await sha256OfFile(src),
      });
    }
  }

  const merged = mergeLockedProvides(plan.locked.provides, fresh);
  return upsertLockedEntry(lf, {
    id: plan.entry.id,
    version: plan.entry.version,
    installed_at: new Date().toISOString(),
    provides: merged,
  });
}
