import { existsSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { CONTENT_DIR } from "../paths.js";
import {
  ensureDirAndWrite,
  fileExists,
  readText,
} from "../io.js";
import {
  ask,
  chooseConflictAction,
  isInteractive,
} from "../prompt.js";

export type CoachKind =
  | "claude-md"
  | "practices"
  | "agent-profile"
  | "adr-init"
  | "adr";

export interface CoachOptions {
  cwd: string;
  kind: CoachKind;
  positional: string[];
  nested?: string;
  title?: string;
  name?: string;
  nonInteractive: boolean;
  dryRun: boolean;
}

type WriteOutcome =
  | "written"
  | "unchanged"
  | "kept"
  | "overwritten"
  | "skipped-exists"
  | "would-write"
  | "would-overwrite"
  | "would-prompt";

const GLYPH: Record<WriteOutcome, string> = {
  written: "+",
  unchanged: "=",
  kept: "·",
  overwritten: "~",
  "skipped-exists": "·",
  "would-write": "+",
  "would-overwrite": "~",
  "would-prompt": "?",
};

interface WriteResult {
  outcome: WriteOutcome;
  reason?: string;
}

const SLUG_RE = /^[a-z][a-z0-9-]*$/;

export async function runCoach(opts: CoachOptions): Promise<number> {
  const interactive = !opts.nonInteractive && isInteractive();
  switch (opts.kind) {
    case "claude-md":
      return coachClaudeMd(opts, interactive);
    case "practices":
      return coachPractices(opts, interactive);
    case "agent-profile":
      return coachAgentProfile(opts, interactive);
    case "adr-init":
      return coachAdrInit(opts, interactive);
    case "adr":
      return coachAdr(opts, interactive);
  }
}

async function coachClaudeMd(
  opts: CoachOptions,
  interactive: boolean,
): Promise<number> {
  if (opts.nested) {
    const subdir = opts.nested;
    if (!isRepoRelative(subdir)) {
      console.error(`coach claude-md: --nested must be a repo-relative subdir`);
      return 1;
    }
    const absSubdir = resolve(opts.cwd, subdir);
    if (!existsSync(absSubdir)) {
      console.error(`coach claude-md: subdir not found: ${subdir}`);
      console.error(`  Create the directory first, then re-run.`);
      return 1;
    }
    const subsystem = opts.name ?? basename(absSubdir);
    const tpl = await readText(
      resolve(CONTENT_DIR, "templates", "CLAUDE.nested.template.md"),
    );
    const rendered = tpl.replaceAll("<SUBSYSTEM_NAME>", subsystem);
    const dest = resolve(absSubdir, "CLAUDE.md");
    const result = await writeWithPrompt(rendered, dest, opts, interactive);
    printSummary("nested CLAUDE.md", [{ rel: relative(opts.cwd, dest), result }]);
    return 0;
  }

  const projectName = await resolveProjectName(opts, interactive);
  const tpl = await readText(
    resolve(CONTENT_DIR, "templates", "CLAUDE.template.md"),
  );
  const rendered = tpl.replaceAll("<PROJECT_NAME>", projectName);
  const dest = resolve(opts.cwd, "CLAUDE.md");
  const result = await writeWithPrompt(rendered, dest, opts, interactive);
  printSummary("CLAUDE.md", [{ rel: "CLAUDE.md", result }]);
  return 0;
}

async function coachPractices(
  opts: CoachOptions,
  interactive: boolean,
): Promise<number> {
  const projectName = await resolveProjectName(opts, interactive);
  const tpl = await readText(
    resolve(CONTENT_DIR, "templates", "PRACTICES.template.md"),
  );
  const rendered = tpl.replaceAll("<PROJECT_NAME>", projectName);
  const dest = resolve(opts.cwd, "PRACTICES.md");
  const result = await writeWithPrompt(rendered, dest, opts, interactive);
  printSummary("PRACTICES.md", [{ rel: "PRACTICES.md", result }]);
  return 0;
}

async function coachAgentProfile(
  opts: CoachOptions,
  interactive: boolean,
): Promise<number> {
  const projectName = await resolveProjectName(opts, interactive);
  const tpl = await readText(
    resolve(CONTENT_DIR, "templates", "agent.template.toml"),
  );
  const rendered = tpl.replaceAll("<PROJECT_NAME>", projectName);
  const dest = resolve(opts.cwd, ".agent.toml");
  const result = await writeWithPrompt(rendered, dest, opts, interactive);
  printSummary(".agent.toml", [{ rel: ".agent.toml", result }]);
  return 0;
}

async function coachAdrInit(
  opts: CoachOptions,
  interactive: boolean,
): Promise<number> {
  const projectName = await resolveProjectName(opts, interactive);
  const date = todayIso();
  const adrDir = resolve(opts.cwd, "docs", "adr");

  const files = [
    {
      tpl: "templates/adr/template.md",
      out: "docs/adr/template.md",
      transform: (s: string) => s,
    },
    {
      tpl: "templates/adr/README.template.md",
      out: "docs/adr/README.md",
      transform: (s: string) => s.replaceAll("<PROJECT_NAME>", projectName),
    },
    {
      tpl: "templates/adr/0000-record-architecture-decisions.template.md",
      out: "docs/adr/0000-record-architecture-decisions.md",
      transform: (s: string) =>
        s
          .replaceAll("<PROJECT_NAME>", projectName)
          .replaceAll("<YYYY-MM-DD>", date),
    },
  ];

  const summary: { rel: string; result: WriteResult }[] = [];
  for (const f of files) {
    const tpl = await readText(resolve(CONTENT_DIR, f.tpl));
    const rendered = f.transform(tpl);
    const dest = resolve(opts.cwd, f.out);
    // adr-init uses skip-if-exists semantics — never overwrite existing ADR setup
    const result = await writeSkipIfExists(rendered, dest, opts);
    summary.push({ rel: f.out, result });
  }

  printSummary(`ADR setup at ${relative(opts.cwd, adrDir)}/`, summary);
  return 0;
}

async function coachAdr(
  opts: CoachOptions,
  interactive: boolean,
): Promise<number> {
  const slug = opts.positional[0];
  if (!slug) {
    console.error(`coach adr: missing slug`);
    console.error(`Usage: agentry coach adr <slug> [path]`);
    return 1;
  }
  if (!SLUG_RE.test(slug) || slug.length > 60) {
    console.error(
      `coach adr: slug must be kebab-case [a-z][a-z0-9-]*, ≤60 chars (got '${slug}')`,
    );
    return 1;
  }

  const adrDir = resolve(opts.cwd, "docs", "adr");
  if (!existsSync(adrDir)) {
    console.error(`coach adr: docs/adr/ does not exist.`);
    console.error(`  Run 'agentry coach adr-init' first.`);
    return 1;
  }

  const next = nextAdrNumber(adrDir);
  const numStr = String(next).padStart(4, "0");
  const dest = resolve(adrDir, `${numStr}-${slug}.md`);
  if (existsSync(dest)) {
    console.error(`coach adr: ${relative(opts.cwd, dest)} already exists.`);
    return 1;
  }

  let title = opts.title;
  if (!title) {
    if (interactive) {
      title = await ask(`ADR ${numStr} title: `);
      if (!title) {
        console.error(`coach adr: title is required.`);
        return 1;
      }
    } else {
      title = humanizeSlug(slug);
    }
  }

  const tpl = await readText(
    resolve(CONTENT_DIR, "templates", "adr", "template.md"),
  );
  const rendered = tpl
    .replace(
      "# NNNN — <Title in imperative or noun-phrase form>",
      `# ${numStr} — ${title}`,
    )
    .replace("**Date:** YYYY-MM-DD", `**Date:** ${todayIso()}`);

  if (opts.dryRun) {
    console.log(
      `\nagentry coach adr (dry-run)\n  ${GLYPH["would-write"]} ${relative(opts.cwd, dest)} would-write`,
    );
    return 0;
  }
  await ensureDirAndWrite(dest, rendered);
  console.log(
    `\nagentry coach adr\n  ${GLYPH.written} ${relative(opts.cwd, dest)} written`,
  );
  console.log(`\nNext: fill in Context / Decision / Consequences / Alternatives.`);
  return 0;
}

async function writeWithPrompt(
  contents: string,
  dest: string,
  opts: CoachOptions,
  interactive: boolean,
): Promise<WriteResult> {
  if (fileExists(dest)) {
    const existing = await readText(dest);
    if (existing === contents) return { outcome: "unchanged" };
    if (opts.dryRun) return { outcome: "would-prompt", reason: "differs" };
    if (!interactive) {
      return { outcome: "kept", reason: "non-interactive default" };
    }
    // shell out to git diff via the shared helper — needs source-on-disk; write tmp
    const tmpSrc = await stageTempForDiff(contents);
    const action = await chooseConflictAction(
      relative(opts.cwd, dest),
      tmpSrc,
      dest,
    );
    if (action === "overwrite") {
      await ensureDirAndWrite(dest, contents);
      return { outcome: "overwritten" };
    }
    return { outcome: "kept" };
  }
  if (opts.dryRun) return { outcome: "would-write" };
  await ensureDirAndWrite(dest, contents);
  return { outcome: "written" };
}

async function writeSkipIfExists(
  contents: string,
  dest: string,
  opts: CoachOptions,
): Promise<WriteResult> {
  if (fileExists(dest)) {
    const existing = await readText(dest);
    if (existing === contents) return { outcome: "unchanged" };
    return { outcome: "skipped-exists" };
  }
  if (opts.dryRun) return { outcome: "would-write" };
  await ensureDirAndWrite(dest, contents);
  return { outcome: "written" };
}

async function stageTempForDiff(contents: string): Promise<string> {
  const { tmpdir } = await import("node:os");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const dir = await mkdtemp(resolve(tmpdir(), "agentry-coach-"));
  const tmp = resolve(dir, "rendered.md");
  await writeFile(tmp, contents);
  return tmp;
}

async function resolveProjectName(
  opts: CoachOptions,
  interactive: boolean,
): Promise<string> {
  if (opts.name) return opts.name;
  const fallback = basename(resolve(opts.cwd));
  if (!interactive) return fallback;
  const ans = await ask(`Project name? [${fallback}] `, fallback);
  return ans;
}

function nextAdrNumber(adrDir: string): number {
  let max = -1;
  for (const f of readdirSync(adrDir)) {
    const m = /^(\d{4})-/.exec(f);
    if (m && m[1] !== undefined) {
      const n = Number.parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w, i) => (i === 0 ? capitalize(w) : w))
    .join(" ");
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRepoRelative(p: string): boolean {
  if (!p || p.startsWith("/") || p.startsWith("..")) return false;
  return !p.split(/[\\/]/).includes("..");
}

function relative(from: string, to: string): string {
  const f = resolve(from);
  const t = resolve(to);
  if (t.startsWith(f + "/")) return t.slice(f.length + 1);
  if (t === f) return ".";
  return t;
}

function printSummary(
  what: string,
  items: { rel: string; result: WriteResult }[],
): void {
  console.log(`\nagentry coach — ${what}`);
  for (const { rel, result } of items) {
    const reason = result.reason ? ` (${result.reason})` : "";
    console.log(`  ${GLYPH[result.outcome]} ${rel.padEnd(50)} ${result.outcome}${reason}`);
  }
}
