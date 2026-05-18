import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { readGuidanceParts } from "./_shared/guidance-content.js";

const PROBE_VERSION = "1.1.0";
const MAX_GUIDANCE_CHARS = 12_000;
const MAX_TREE_ENTRIES = 200;

const RUBRIC = {
  task: "Score how FRESH the agent-guidance file is — does it still match the current state of the repo? You will see the guidance content alongside a snapshot of the repo (top-level tree, package.json scripts). Penalise stale claims; reward content that aligns with what's actually there.",
  criteria: [
    {
      id: "paths-exist",
      description:
        "Do the file paths and directory names mentioned in the guidance still exist in the tree snapshot? Penalise references to paths that have been removed or renamed.",
    },
    {
      id: "commands-valid",
      description:
        "Do the build/test/run commands referenced in the guidance match the actual scripts in package.json (or the actual tooling visible in the tree)? Penalise commands that no longer resolve.",
    },
    {
      id: "architecture-matches",
      description:
        "Does the architectural description (modules, packages, layering) match the current directory layout? Penalise stale claims about packages or modules that no longer exist, or omissions of major new ones.",
    },
    {
      id: "no-stale-claims",
      description:
        "Are there claims about features, status, deadlines, or in-progress work that look outdated relative to the current state? A '🚧 in progress' note for something that's clearly shipped, or a 'coming soon' for something that's been there for a year, costs points.",
    },
  ],
} as const;

export default defineProbe({
  id: "agent.guidance-fresh",
  version: PROBE_VERSION,
  dimensions: [
    { id: "context", weight: 1 },
    { id: "consistency", weight: 0.5 },
  ],
  tier: "reasoned",
  evidence: ["agent_config", "files", "node_package", "size_stats", "judge"],

  rationale: `
    A CLAUDE.md or AGENTS.md that's well-written but out-of-date is worse than
    no guidance at all — the agent will confidently follow stale directions
    into dead ends. This probe asks an LLM to compare guidance content
    against a snapshot of the actual repo (top-level tree, package.json
    scripts) and flag references that no longer resolve: paths that have
    moved, commands that don't exist, architecture descriptions that don't
    match the current layout, in-progress markers for shipped features.
  `,

  remediation:
    "Sweep your CLAUDE.md / AGENTS.md against the current repo: every path mentioned should exist, every command should resolve to a real script, every architecture claim should match the layout, every status note ('in progress', 'coming soon') should still be true. Re-run this probe after the sweep — a stale guidance file silently misdirects every agent that lands.",

  async detect(ev) {
    const guidance = ev.agent_config.guidance;
    if (guidance.length === 0) {
      return { kind: "na", reason: "no agent-guidance file present" };
    }

    const parts = (await readGuidanceParts(guidance, ev.files, MAX_GUIDANCE_CHARS)).map(
      (part) => `# ${part.path}\n\n${part.text}`,
    );
    if (parts.length === 0) {
      return { kind: "na", reason: "agent-guidance files declared but unreadable" };
    }

    const topLevel = new Set<string>();
    for (const f of ev.size_stats.files) {
      const top = f.path.split("/")[0];
      if (top) topLevel.add(top);
    }
    const treeEntries = Array.from(topLevel).sort().slice(0, MAX_TREE_ENTRIES);
    const treeSection = `## Top-level entries\n${treeEntries.join("\n")}`;

    let scriptsSection = "";
    if (ev.node_package.present) {
      const names = Object.keys(ev.node_package.scripts).sort();
      scriptsSection = `\n\n## package.json scripts\n${names.join("\n")}`;
    }

    const repoSnapshot = `${treeSection}${scriptsSection}`;
    const guidanceCombined = parts.join("\n\n---\n\n");
    const input = `# REPO SNAPSHOT\n\n${repoSnapshot}\n\n---\n\n# AGENT GUIDANCE\n\n${guidanceCombined}`;

    const result = await ev.judge.score({
      probeId: "agent.guidance-fresh",
      probeVersion: PROBE_VERSION,
      input,
      rubric: RUBRIC,
    });

    return {
      kind: "judge",
      score: result.score,
      perCriterion: result.perCriterion,
      rationale: result.rationale,
      model: result.model,
    };
  },

  score: { kind: "judge" },

  fixtures: [
    {
      name: "no-guidance",
      evidence: {
        agent_config: { guidance: [] },
        node_package: { present: false },
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "na", reason: "no agent-guidance file present" }, score: null },
    },
    {
      name: "fresh-guidance",
      evidence: {
        agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 500, lines: 20 }] },
        files: {
          "CLAUDE.md":
            "# Project\n\nMain code lives in `src/`. Run `npm test` and `npm run build`.",
        },
        node_package: { present: true, scripts: { test: "vitest", build: "tsc" } },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 500,
          totalFiles: 2,
          files: [
            { path: "src/index.ts", bytes: 300, lines: 10, depth: 1 },
            { path: "CLAUDE.md", bytes: 200, lines: 10, depth: 0 },
          ],
        },
        judge: {
          score: 90,
          perCriterion: {
            "paths-exist": 100,
            "commands-valid": 100,
            "architecture-matches": 80,
            "no-stale-claims": 80,
          },
          rationale: "All references match repo state.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 90,
          perCriterion: {
            "paths-exist": 100,
            "commands-valid": 100,
            "architecture-matches": 80,
            "no-stale-claims": 80,
          },
          rationale: "All references match repo state.",
          model: "fixture",
        },
        score: 90,
      },
    },
    {
      name: "stale-guidance",
      evidence: {
        agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 500, lines: 20 }] },
        files: {
          "CLAUDE.md":
            "# Project\n\nCode lives in `lib/`. Run `npm run dev` for the dev server. The `experimental/` folder is 🚧 in progress.",
        },
        node_package: { present: true, scripts: { test: "vitest" } },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 500,
          totalFiles: 2,
          files: [
            { path: "src/index.ts", bytes: 300, lines: 10, depth: 1 },
            { path: "CLAUDE.md", bytes: 200, lines: 10, depth: 0 },
          ],
        },
        judge: {
          score: 25,
          perCriterion: {
            "paths-exist": 20,
            "commands-valid": 20,
            "architecture-matches": 30,
            "no-stale-claims": 30,
          },
          rationale:
            "References lib/ and experimental/ which don't exist; npm run dev not a script.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 25,
          perCriterion: {
            "paths-exist": 20,
            "commands-valid": 20,
            "architecture-matches": 30,
            "no-stale-claims": 30,
          },
          rationale:
            "References lib/ and experimental/ which don't exist; npm run dev not a script.",
          model: "fixture",
        },
        score: 25,
      },
    },
  ],
});
