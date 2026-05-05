import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ScanManifest } from "./types.js";

export interface BriefResult {
  briefPath: string;
  bundleDir: string;
}

interface CatalogSnapshot {
  entries: Array<{
    id: string;
    name: string;
    description: string;
    kind: "practice" | "artifact";
    overlay?: string;
    practiceFile?: string;
  }>;
}

export async function emitBrief(bundleDir: string): Promise<BriefResult> {
  const manifestPath = join(bundleDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`scan bundle missing manifest.json at ${manifestPath}`);
  }
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as ScanManifest;

  const catalogPath = join(bundleDir, "catalog.json");
  const catalog: CatalogSnapshot | null = existsSync(catalogPath)
    ? (JSON.parse(await readFile(catalogPath, "utf8")) as CatalogSnapshot)
    : null;

  const practices = await readPractices(bundleDir, catalog);

  const briefPath = join(bundleDir, "instructions.md");
  const body = renderBrief(bundleDir, manifest, practices);
  await writeFile(briefPath, body);
  return { briefPath, bundleDir };
}

interface PracticeDoc {
  id: string;
  name: string;
  description: string;
  body: string;
}

async function readPractices(
  bundleDir: string,
  catalog: CatalogSnapshot | null,
): Promise<PracticeDoc[]> {
  if (!catalog) return [];
  const out: PracticeDoc[] = [];
  for (const e of catalog.entries) {
    if (e.kind !== "practice" || !e.practiceFile) continue;
    const path = join(bundleDir, e.practiceFile);
    if (!existsSync(path)) continue;
    const body = await readFile(path, "utf8");
    out.push({ id: e.id, name: e.name, description: e.description, body });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function renderBrief(
  bundleDir: string,
  manifest: ScanManifest,
  practices: PracticeDoc[],
): string {
  const lines: string[] = [];
  const repoRel = (p: string): string =>
    relative(manifest.cwd, join(bundleDir, p)) || p;

  lines.push(`# agentry brief — ${manifest.cwd}`);
  lines.push("");
  lines.push(
    `Scanned at ${manifest.scannedAt} (agentry ${manifest.agentryVersion}, bundle v${manifest.version}).`,
  );
  lines.push(`Bundle: \`${bundleDir}\``);
  lines.push("");

  lines.push(`## Your job`);
  lines.push("");
  lines.push(
    "You are an agent helping make this repo agentic-ready. The scan bundle below is deterministic evidence; you do the analysis and the authoring. Do **not** invent files that aren't referenced in the bundle. Do **not** hallucinate `agentry add <id>` ids — only use ids from `catalog.json`.",
  );
  lines.push("");
  lines.push(
    "Produce three sections in your reply, in order:",
  );
  lines.push("");
  lines.push("1. **Diagnosis** — 3–6 paragraphs. What is this repo? What state is its agentic-readiness in? What's the most important gap?");
  lines.push(
    "2. **Shopping list** — `agentry add <id>` commands for any overlay artifacts that fit. Each line: command + one-sentence justification grounded in a bundle path.",
  );
  lines.push(
    "3. **Author plan** — files you would write/edit (CLAUDE.md, ARCHITECTURE.md, ADRs, specs, etc.) with a one-line rationale each. Use bundle evidence to tailor — don't write generic boilerplate. After writing, the user will rerun `agentry scan` to verify.",
  );
  lines.push("");

  lines.push("## Bundle pointers");
  lines.push("");
  lines.push("Read these in roughly this order:");
  lines.push("");
  lines.push(`- \`${repoRel("manifest.json")}\` — what was collected, what was skipped or failed`);
  lines.push(`- \`${repoRel("catalog.json")}\` — agentry catalog snapshot (the only valid \`agentry add <id>\` ids)`);
  lines.push(`- \`${repoRel("structure/tree.txt")}\` — file tree (depth-bounded)`);
  lines.push(`- \`${repoRel("structure/languages.json")}\` — LOC per language`);
  lines.push(`- \`${repoRel("structure/manifests.json")}\` — detected build/dep manifests`);
  lines.push(`- \`${repoRel("git/stats.json")}\`, \`${repoRel("git/commit-messages.txt")}\`, \`${repoRel("git/hot-files.json")}\`, \`${repoRel("git/pr-samples.json")}\``);
  lines.push(`- \`${repoRel("hygiene/checklist.json")}\`, \`${repoRel("hygiene/ci-coverage.json")}\`, \`${repoRel("hygiene/linters.json")}\`, \`${repoRel("hygiene/gitignore-audit.json")}\`, \`${repoRel("hygiene/readme-structure.json")}\``);
  lines.push(`- \`${repoRel("security/secrets-suspects.json")}\`, \`${repoRel("security/committed-keys.json")}\`, \`${repoRel("security/lockfile-age.json")}\`, \`${repoRel("security/audit.json")}\``);
  lines.push(`- \`${repoRel("agent-readiness/report.json")}\` — existing CLAUDE.md / ADRs / specs / configs / stale signals`);
  lines.push(`- \`${repoRel("docs/readme-head.md")}\`, \`${repoRel("docs/root-headings.json")}\`, \`${repoRel("docs/claude-md.md")}\` (if present)`);
  if (manifest.options.fitness) {
    lines.push(`- \`${repoRel("fitness/results.json")}\` — build/test/typecheck/lint output (executed user code)`);
  }
  lines.push("");

  lines.push("## Reading rules");
  lines.push("");
  lines.push("- **Practices vs artifacts.** Bundled entries with `kind = \"practice\"` (also inlined below in the Practice library) are guidance — read them, adapt to this repo, **never** suggest `agentry add` on a practice id. Overlay entries (`kind = \"artifact\"`, have an `overlay` field) are byte-perfect team files — `agentry add <id>` drops them in unchanged. If the user wants a team standard and has no overlay yet, recommend creating one rather than authoring per-repo.");
  lines.push("- **Catalog ids only.** The full list of valid `agentry add <id>` ids is in `catalog.json` under `entries[].id`. Anything not in that list is a hallucination.");
  lines.push("- **Author from evidence.** Tailor CLAUDE.md / ARCHITECTURE.md / ADRs to what's actually in `structure/`, `git/`, `agent-readiness/`. Generic boilerplate is worse than nothing.");
  lines.push("- **Stale signals matter.** If `agent-readiness/report.json` shows ADRs / CLAUDE.md not touched in over a year while `git/hot-files.json` shows churn, flag the doc as outdated rather than treating it as ground truth.");

  if (manifest.options.fitness === false) {
    lines.push("");
    lines.push("## Fitness was skipped");
    lines.push("");
    lines.push(
      "The user passed `--no-fitness`. You have no signal on whether the repo builds, tests pass, type-checks, or lints. Do not assert quality — the absence of evidence is not evidence of absence.",
    );
  } else {
    const fitnessStatus = manifest.gatherers.find((g) => g.name === "fitness");
    if (fitnessStatus && fitnessStatus.status === "failed") {
      lines.push("");
      lines.push("## Fitness gatherer failed");
      lines.push("");
      lines.push(
        `Reason: ${fitnessStatus.reason ?? "unknown"}. Treat fitness signal as missing.`,
      );
    }
  }

  const failed = manifest.gatherers.filter((g) => g.status === "failed");
  if (failed.length > 0) {
    lines.push("");
    lines.push("## Gatherer failures");
    lines.push("");
    for (const g of failed) {
      lines.push(`- **${g.name}**: ${g.reason ?? "unknown error"}`);
    }
  }

  const skipped = manifest.gatherers.filter((g) => g.status === "skipped");
  if (skipped.length > 0) {
    lines.push("");
    lines.push("## Gatherers skipped");
    lines.push("");
    for (const g of skipped) {
      lines.push(`- **${g.name}**: ${g.reason ?? "not enabled"}`);
    }
  }

  if (practices.length > 0) {
    lines.push("");
    lines.push("## Practice library");
    lines.push("");
    lines.push(
      "These are the bundled practices — guidance docs, not installable files. Read them, adapt to this repo, cite them in your Author plan when relevant. Do **not** run `agentry add` on these ids.",
    );
    for (const p of practices) {
      lines.push("");
      lines.push(`### ${p.name} (\`${p.id}\`)`);
      lines.push("");
      lines.push(`> ${p.description}`);
      lines.push("");
      lines.push(p.body.trimEnd());
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("After you write or edit files, the user will rerun `agentry scan` to verify the gaps closed. Re-scan is the truth.");

  return lines.join("\n") + "\n";
}
