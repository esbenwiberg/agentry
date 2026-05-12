import type { Location } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const ADR_DIRS = ["docs/adr/", "doc/adr/", "adr/", "decisions/", "docs/decisions/"];
const ADR_FILE_PATTERN = /\.(md|markdown)$/i;

export default defineProbe({
  id: "docs.adr-presence",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "derived",
  evidence: ["size_stats"],

  rationale: `
    Architecture Decision Records explain *why* the codebase looks the way
    it does — exactly the questions an agent would otherwise ask the team.
    Counting ADRs is cheap and revealing: zero means decisions are tribal
    knowledge.
  `,

  async detect(ev) {
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    const samples: Location[] = [];
    for (const f of ev.size_stats.files) {
      if (ADR_DIRS.some((d) => f.path.startsWith(d)) && ADR_FILE_PATTERN.test(f.path)) {
        samples.push({ path: f.path });
      }
    }
    return { kind: "count", value: samples.length, samples: samples.slice(0, 5) };
  },

  score: {
    kind: "count",
    direction: "positive",
    bands: [{ upTo: 0, score: 0 }, { upTo: 2, score: 30 }, { upTo: 5, score: 70 }, { score: 100 }],
  },

  fixtures: [
    {
      name: "no-adrs",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 0,
          totalFiles: 1,
          files: [{ path: "src/x.ts", bytes: 1, lines: 1, depth: 2 }],
        },
      },
      expect: { reading: { kind: "count", value: 0, samples: [] }, score: 0 },
    },
    {
      name: "three-adrs",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 0,
          totalFiles: 3,
          files: [
            { path: "docs/adr/0001-intro.md", bytes: 1, lines: 1, depth: 3 },
            { path: "docs/adr/0002-stack.md", bytes: 1, lines: 1, depth: 3 },
            { path: "docs/adr/0003-license.md", bytes: 1, lines: 1, depth: 3 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "count",
          value: 3,
          samples: [
            { path: "docs/adr/0001-intro.md" },
            { path: "docs/adr/0002-stack.md" },
            { path: "docs/adr/0003-license.md" },
          ],
        },
        score: 70,
      },
    },
  ],
});
