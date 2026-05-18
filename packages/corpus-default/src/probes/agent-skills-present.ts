import { defineProbe } from "@esbenwiberg/repofit/sdk";

const SKILL_FILE_PATTERNS = [
  /^\.codex\/skills\/[^/]+\/SKILL\.md$/i,
  /^\.agents\/skills\/[^/]+\/SKILL\.md$/i,
  /^agents\/skills\/[^/]+\/SKILL\.md$/i,
  /^\.claude\/commands\/.+\.md$/i,
  /^\.cursor\/rules\/.+\.mdc$/i,
  /^\.windsurf\/rules\/.+\.md$/i,
  /^prompts\/agents\/.+\.md$/i,
];

export default defineProbe({
  id: "agent.skills-present",
  version: "1.0.0",
  dimensions: [
    { id: "context", weight: 1 },
    { id: "feedback", weight: 0.3 },
  ],
  tier: "static",
  evidence: ["size_stats"],

  rationale: `
    Repository-local skills and slash commands turn recurring agent work into
    reusable procedures: commit workflow, new-probe authoring, release, smoke
    testing, debugging, review. Generic guidance tells an agent what matters;
    skills give it a repeatable path through high-friction tasks.
  `,

  remediation:
    "Add repo-local agent skills or commands for repeated workflows. Good starting points: `/commit`, `/new-probe`, `/release`, `/smoke`, `/debug-failing-ci`, and `/review`. Store them in a tool-native location such as `.codex/skills/<name>/SKILL.md`, `.claude/commands/*.md`, or `.cursor/rules/*.mdc`.",

  async detect(ev) {
    const samples = ev.size_stats.files
      .map((f) => f.path)
      .filter((p) => SKILL_FILE_PATTERNS.some((pattern) => pattern.test(p)))
      .sort()
      .map((path) => ({ path }));

    return { kind: "count", value: samples.length, samples };
  },

  score: {
    kind: "count",
    direction: "positive",
    bands: [{ upTo: 0, score: 0 }, { upTo: 1, score: 60 }, { upTo: 3, score: 80 }, { score: 100 }],
  },

  fixtures: [
    {
      name: "no-local-skills",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "CLAUDE.md", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "count", value: 0, samples: [] }, score: 0 },
    },
    {
      name: "codex-and-claude-skills",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 300,
          totalFiles: 3,
          files: [
            { path: ".codex/skills/new-probe/SKILL.md", bytes: 100, lines: 20, depth: 3 },
            { path: ".claude/commands/commit.md", bytes: 100, lines: 15, depth: 2 },
            { path: ".cursor/rules/testing.mdc", bytes: 100, lines: 15, depth: 2 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "count",
          value: 3,
          samples: [
            { path: ".claude/commands/commit.md" },
            { path: ".codex/skills/new-probe/SKILL.md" },
            { path: ".cursor/rules/testing.mdc" },
          ],
        },
        score: 80,
      },
    },
  ],
});
