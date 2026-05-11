import { defineProbe } from "@esbenwiberg/repofit/sdk";

const STRATEGY_PATHS = [
  "CHANGELOG.md",
  "CHANGES.md",
  "RELEASES.md",
  ".changeset/config.json",
  ".changes/config.json",
];

export default defineProbe({
  id: "changelog.strategy-declared",
  version: "0.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  tier: "static",
  evidence: ["files"],

  rationale: `
    A declared changelog strategy tells the agent how release notes are
    captured here — a hand-edited CHANGELOG, a fragments directory, or a
    tool like changesets. Without a declared strategy, the agent has to
    guess, and may invent a process that conflicts with the team's actual
    release flow.
  `,

  async detect(ev) {
    return { kind: "predicate", value: STRATEGY_PATHS.some((p) => ev.files.has(p)) };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "changelog-md",
      evidence: { files: ["CHANGELOG.md"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "changesets",
      evidence: { files: [".changeset/config.json"] },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "no-strategy",
      evidence: { files: [] },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
