import { defineProbe } from "@esbenwiberg/repofit/sdk";

const BUCKETS: { name: string; samples: string[] }[] = [
  { name: "env files", samples: [".env", ".env.local"] },
  { name: "build artifacts", samples: ["dist/x.js", "build/x.js", "out/x.js"] },
  { name: "node modules", samples: ["node_modules/foo/index.js"] },
  { name: "OS junk", samples: [".DS_Store", "Thumbs.db"] },
  { name: "editor state", samples: [".idea/x", ".vscode/settings.json"] },
];

const PRESENT_THRESHOLD = 4;

export default defineProbe({
  id: "gitignore.comprehensive",
  version: "0.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  tier: "derived",
  evidence: ["gitignore"],

  rationale: `
    A gitignore that covers the obvious bucket-patterns (env files, build
    artifacts, node_modules, OS junk, editor state) prevents an agent from
    accidentally committing the wrong file. Coverage is checked by sample
    paths from each bucket; missing buckets surface as a missed probe.
  `,

  async detect(ev) {
    if (!ev.gitignore.present) return { kind: "predicate", value: false };
    let covered = 0;
    for (const bucket of BUCKETS) {
      if (bucket.samples.some((p) => ev.gitignore.ignores(p))) covered += 1;
    }
    return { kind: "predicate", value: covered >= PRESENT_THRESHOLD };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-gitignore",
      evidence: { gitignore: { present: false, patterns: [] } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "comprehensive",
      evidence: {
        gitignore: {
          present: true,
          patterns: ["node_modules/", "dist/", ".env", ".DS_Store", ".idea/"],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "sparse",
      evidence: {
        gitignore: { present: true, patterns: ["node_modules/"] },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
