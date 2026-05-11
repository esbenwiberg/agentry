import type { Location } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const LINE_THRESHOLD = 2000;
const BYTE_THRESHOLD = 100 * 1024;

export default defineProbe({
  id: "size.large-files",
  version: "1.0.0",
  dimensions: [{ id: "cost", weight: 1 }],
  tier: "derived",
  evidence: ["size_stats"],

  rationale: `
    Large files punish agents twice: they cost more tokens to load and they
    invite "find the relevant 20 lines in this 3000-line file" reasoning
    detours. Counting files past a width threshold surfaces the worst
    offenders.
  `,

  async detect(ev) {
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    const samples: Location[] = [];
    for (const f of ev.size_stats.files) {
      if (f.lines > LINE_THRESHOLD || f.bytes > BYTE_THRESHOLD) {
        samples.push({ path: f.path });
      }
    }
    return { kind: "count", value: samples.length, samples };
  },

  score: {
    kind: "count",
    direction: "negative",
    bands: [
      { upTo: 0, score: 100 },
      { upTo: 2, score: 80 },
      { upTo: 5, score: 60 },
      { upTo: 10, score: 30 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "no-large-files",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "src/index.ts", bytes: 100, lines: 5, depth: 2 }],
        },
      },
      expect: { reading: { kind: "count", value: 0, samples: [] }, score: 100 },
    },
    {
      name: "one-giant",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 5000000,
          totalFiles: 1,
          files: [{ path: "src/legacy.ts", bytes: 5000000, lines: 3000, depth: 2 }],
        },
      },
      expect: {
        reading: { kind: "count", value: 1, samples: [{ path: "src/legacy.ts" }] },
        score: 80,
      },
    },
    {
      name: "no-evidence",
      evidence: {
        size_stats: { source: "none", totalBytes: 0, totalFiles: 0, files: [] },
      },
      expect: { reading: { kind: "na", reason: "no git working tree" }, score: null },
    },
  ],
});
