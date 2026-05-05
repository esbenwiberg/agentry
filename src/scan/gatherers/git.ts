import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Gatherer, GathererContext } from "../types.js";
import { execCmd } from "../exec.js";

interface GitStats {
  totalCommits: number;
  uniqueAuthors: number;
  firstCommitISO: string | null;
  lastCommitISO: string | null;
  defaultBranch: string | null;
  topAuthors: Array<{ name: string; commits: number }>;
}

interface HotFile {
  path: string;
  changes: number;
}

async function runGit(
  cwd: string,
  args: readonly string[],
  timeoutMs = 15_000,
): Promise<{ ok: boolean; stdout: string }> {
  const r = await execCmd("git", args, { cwd, timeoutMs });
  return { ok: r.exitCode === 0, stdout: r.stdout };
}

async function gatherStats(cwd: string): Promise<GitStats> {
  const stats: GitStats = {
    totalCommits: 0,
    uniqueAuthors: 0,
    firstCommitISO: null,
    lastCommitISO: null,
    defaultBranch: null,
    topAuthors: [],
  };

  const total = await runGit(cwd, ["rev-list", "--count", "HEAD"]);
  if (total.ok) stats.totalCommits = parseInt(total.stdout.trim(), 10) || 0;

  const authors = await runGit(cwd, ["shortlog", "-sne", "HEAD"]);
  if (authors.ok) {
    const lines = authors.stdout.split("\n").filter((l) => l.trim().length > 0);
    stats.uniqueAuthors = lines.length;
    stats.topAuthors = lines.slice(0, 10).map((line) => {
      const m = line.trim().match(/^(\d+)\s+(.+?)\s+<.+>$/);
      if (!m) return { name: line.trim(), commits: 0 };
      return { name: m[2]!, commits: parseInt(m[1]!, 10) || 0 };
    });
  }

  const first = await runGit(cwd, [
    "log",
    "--reverse",
    "--format=%aI",
    "--max-count=1",
  ]);
  if (first.ok && first.stdout.trim()) stats.firstCommitISO = first.stdout.trim();

  const last = await runGit(cwd, ["log", "--format=%aI", "--max-count=1"]);
  if (last.ok && last.stdout.trim()) stats.lastCommitISO = last.stdout.trim();

  const head = await runGit(cwd, ["symbolic-ref", "--short", "HEAD"]);
  if (head.ok) stats.defaultBranch = head.stdout.trim() || null;

  return stats;
}

async function gatherCommitMessages(cwd: string, limit = 100): Promise<string> {
  const r = await runGit(cwd, [
    "log",
    `--max-count=${limit}`,
    "--pretty=format:%h %s",
  ]);
  return r.ok ? r.stdout : "";
}

async function gatherHotFiles(cwd: string, limit = 30): Promise<HotFile[]> {
  const r = await runGit(cwd, [
    "log",
    "--name-only",
    "--pretty=format:",
    "--no-merges",
    "--max-count=500",
  ]);
  if (!r.ok) return [];
  const counts = new Map<string, number>();
  for (const line of r.stdout.split("\n")) {
    const path = line.trim();
    if (!path) continue;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([path, changes]) => ({ path, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, limit);
}

async function detectGhRepo(
  cwd: string,
  available: boolean,
): Promise<{ usable: boolean; reason?: string; recentPRs?: unknown[] }> {
  if (!available) return { usable: false, reason: "gh not installed" };
  const auth = await execCmd("gh", ["auth", "status"], {
    cwd,
    timeoutMs: 5_000,
  });
  if (auth.exitCode !== 0) {
    return { usable: false, reason: "gh not authenticated" };
  }
  const prs = await execCmd(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "all",
      "--limit",
      "20",
      "--json",
      "number,title,state,author,createdAt,mergedAt",
    ],
    { cwd, timeoutMs: 15_000 },
  );
  if (prs.exitCode !== 0) {
    return { usable: false, reason: "gh pr list failed" };
  }
  try {
    const parsed = JSON.parse(prs.stdout) as unknown[];
    return { usable: true, recentPRs: parsed };
  } catch {
    return { usable: false, reason: "gh output unparseable" };
  }
}

export const gitGatherer: Gatherer = {
  name: "git",
  shouldRun(ctx: GathererContext): boolean {
    return existsSync(resolve(ctx.cwd, ".git")) && ctx.toolAvailability.git === true;
  },
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "git");
    await mkdir(dir, { recursive: true });

    const [stats, msgs, hot, gh] = await Promise.all([
      gatherStats(ctx.cwd),
      gatherCommitMessages(ctx.cwd),
      gatherHotFiles(ctx.cwd),
      detectGhRepo(ctx.cwd, ctx.toolAvailability.gh ?? false),
    ]);

    await writeFile(join(dir, "stats.json"), JSON.stringify(stats, null, 2));
    await writeFile(join(dir, "commit-messages.txt"), msgs);
    await writeFile(join(dir, "hot-files.json"), JSON.stringify(hot, null, 2));

    const ghOut = gh.usable
      ? { recentPRs: gh.recentPRs ?? [] }
      : { recentPRs: [], skipped: true, reason: gh.reason ?? "unknown" };
    await writeFile(join(dir, "pr-samples.json"), JSON.stringify(ghOut, null, 2));

    return [
      "git/stats.json",
      "git/commit-messages.txt",
      "git/hot-files.json",
      "git/pr-samples.json",
    ];
  },
};
