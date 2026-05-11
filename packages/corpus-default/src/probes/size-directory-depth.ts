import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "size.directory-depth",
  version: "1.0.0",
  dimensions: [{ id: "cost", weight: 1 }],
  tier: "derived",
  evidence: ["size_stats"],

  rationale: `
    Deeply-nested paths punish agent navigation: more tokens per file
    reference, more cognitive overhead resolving "where does this live?",
    and a higher chance of typos in path-driven tool calls. The p95 of path
    depth is a robust summary that one shallow tree of fixtures can't skew.
  `,

  async detect(ev) {
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    if (ev.size_stats.files.length === 0) {
      return { kind: "na", reason: "no tracked files" };
    }
    const depths = ev.size_stats.files.map((f) => f.depth);
    return { kind: "distribution", samples: depths };
  },

  score: {
    kind: "distribution",
    stat: "p95",
    bands: [
      { upTo: 4, score: 100 },
      { upTo: 6, score: 80 },
      { upTo: 8, score: 50 },
      { upTo: 10, score: 20 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "shallow-tree",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 0,
          totalFiles: 3,
          files: [
            { path: "a.md", bytes: 1, lines: 1, depth: 1 },
            { path: "src/x.ts", bytes: 1, lines: 1, depth: 2 },
            { path: "src/y.ts", bytes: 1, lines: 1, depth: 2 },
          ],
        },
      },
      expect: { reading: { kind: "distribution", samples: [1, 2, 2] }, score: 100 },
    },
    {
      name: "deep-tree",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 0,
          totalFiles: 2,
          files: [
            { path: "a/b/c/d/e/f/g/h/i/file.ts", bytes: 1, lines: 1, depth: 10 },
            { path: "a/b/c/d/e/f/g/h/i/j/k/file.ts", bytes: 1, lines: 1, depth: 12 },
          ],
        },
      },
      expect: { reading: { kind: "distribution", samples: [10, 12] }, score: 0 },
    },
  ],
});
