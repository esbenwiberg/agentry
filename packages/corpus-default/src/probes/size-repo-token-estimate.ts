import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CHARS_PER_TOKEN = 4;

export default defineProbe({
  id: "size.repo-token-estimate",
  version: "1.0.0",
  dimensions: [{ id: "cost", weight: 1 }],
  tier: "derived",
  evidence: ["size_stats"],

  rationale: `
    Total tracked bytes divided by a rough chars-per-token constant is a
    crude but stable proxy for "how expensive is full-repo context here?".
    The bands are coarse on purpose: precision matters less than telling
    you "this repo will cost you" before you commit to it.
  `,

  remediation:
    "If the repo is genuinely too big, split it: move independent subsystems to separate repos, or move generated/vendored content out of source control (use a release artifact, lockfile reference, or `.gitattributes` `linguist-generated=true`). For a working repo you can't split, accept the score — the probe just flags the agent's per-context cost.",

  async detect(ev) {
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    const tokens = Math.round(ev.size_stats.totalBytes / CHARS_PER_TOKEN);
    return { kind: "magnitude", value: tokens, unit: "tokens" };
  },

  score: {
    kind: "magnitude",
    direction: "negative",
    bands: [
      { upTo: 50_000, score: 100 },
      { upTo: 200_000, score: 80 },
      { upTo: 1_000_000, score: 50 },
      { upTo: 5_000_000, score: 20 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "tiny-repo",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 40_000,
          totalFiles: 5,
          files: [],
        },
      },
      expect: { reading: { kind: "magnitude", value: 10_000, unit: "tokens" }, score: 100 },
    },
    {
      name: "medium-repo",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 2_000_000,
          totalFiles: 200,
          files: [],
        },
      },
      expect: { reading: { kind: "magnitude", value: 500_000, unit: "tokens" }, score: 50 },
    },
  ],
});
