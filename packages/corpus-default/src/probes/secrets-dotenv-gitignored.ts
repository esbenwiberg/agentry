import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "secrets.dotenv-gitignored",
  version: "1.0.0",
  dimensions: [{ id: "safety", weight: 1 }],
  tier: "static",
  evidence: ["gitignore"],

  rationale: `
    .env files routinely hold API keys, database passwords, and other
    secrets. If .gitignore doesn't cover them, an agent running "git add"
    or "git commit -A" can leak the entire credential set into history in
    one move. This is a high-blast-radius mistake we can prevent with a
    one-line check.
  `,

  async detect(ev) {
    if (!ev.gitignore.present) return { kind: "na", reason: "no .gitignore" };
    return { kind: "predicate", value: ev.gitignore.ignores(".env") };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-gitignore",
      evidence: { gitignore: { present: false, patterns: [] } },
      expect: { reading: { kind: "na", reason: "no .gitignore" }, score: null },
    },
    {
      name: "dotenv-ignored",
      evidence: { gitignore: { present: true, patterns: [".env"] } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "wildcard-ignored",
      evidence: { gitignore: { present: true, patterns: [".env*"] } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "not-ignored",
      evidence: { gitignore: { present: true, patterns: ["node_modules"] } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
