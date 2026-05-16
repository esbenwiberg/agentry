import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CHARS_PER_TOKEN = 4;

export default defineProbe({
  id: "size.repo-token-estimate",
  version: "1.1.0",
  dimensions: [{ id: "cost", weight: 1 }],
  tier: "derived",
  evidence: ["size_stats"],

  rationale: `
    Total tracked bytes divided by a rough chars-per-token constant is a
    crude but stable proxy for "how expensive is full-repo context here?".
    The bands are coarse on purpose: precision matters less than separating
    cheap, moderate, expensive, and genuinely huge full-repo context loads.
    Generated files (lockfiles, \`linguist-generated\`) are excluded from the
    total — they bloat the byte count without ever entering an agent's context.
  `,

  remediation:
    "If full-repo context is costly, first check whether generated or vendored content is being counted and mark it with `.gitattributes` `linguist-generated=true` when appropriate. For genuinely large repos, split independent subsystems or avoid full-repo context in agent workflows. A moderate score is advisory — it means broad context costs more, not that the repo is inherently too big.",

  async detect(ev) {
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    const effectiveBytes = ev.size_stats.totalBytesEffective ?? ev.size_stats.totalBytes;
    const tokens = Math.round(effectiveBytes / CHARS_PER_TOKEN);
    return { kind: "magnitude", value: tokens, unit: "tokens" };
  },

  score: {
    kind: "magnitude",
    direction: "negative",
    bands: [
      { upTo: 50_000, score: 100 },
      { upTo: 300_000, score: 80 },
      { upTo: 600_000, score: 70 },
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
          totalBytesEffective: 40_000,
          totalFilesEffective: 5,
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
          totalBytesEffective: 2_000_000,
          totalFilesEffective: 200,
          files: [],
        },
      },
      expect: { reading: { kind: "magnitude", value: 500_000, unit: "tokens" }, score: 70 },
    },
    {
      name: "lockfile-doesnt-count",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 500_000,
          totalFiles: 10,
          totalBytesEffective: 40_000,
          totalFilesEffective: 9,
          files: [],
        },
      },
      expect: { reading: { kind: "magnitude", value: 10_000, unit: "tokens" }, score: 100 },
    },
  ],
});
