import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CONVENTIONAL_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|breaking|security)(\([^)]+\))?!?:\s.+/;

export default defineProbe({
  id: "commits.conventional-followed",
  version: "1.0.0",
  dimensions: [{ id: "consistency", weight: 1 }],
  tier: "historical",
  evidence: ["commit_history"],

  rationale: `
    When commit subjects follow Conventional Commits, an agent has a
    template to copy from. Pattern-matching the last N commit subjects
    yields a conformance percentage. Repos with no shared style force
    agents to guess, and what they guess will rarely match what reviewers
    expect.
  `,

  remediation:
    "Adopt Conventional Commits (`type(scope): subject`, where type is feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert/breaking/security). Enforce with a commit-msg hook (e.g., commitlint, or a shell `.githooks/commit-msg`). Document the format in CONTRIBUTING.md or CLAUDE.md so agents can imitate it.",

  async detect(ev) {
    if (!ev.commit_history.available) {
      return { kind: "na", reason: "no git history available" };
    }
    if (ev.commit_history.commits.length === 0) {
      return { kind: "na", reason: "no commits yet" };
    }
    let matches = 0;
    for (const c of ev.commit_history.commits) {
      if (CONVENTIONAL_PATTERN.test(c.subject)) matches += 1;
    }
    const pct = Math.round((matches / ev.commit_history.commits.length) * 100);
    return { kind: "magnitude", value: pct, unit: "%" };
  },

  score: {
    kind: "magnitude",
    direction: "positive",
    bands: [
      { upTo: 30, score: 20 },
      { upTo: 60, score: 50 },
      { upTo: 85, score: 80 },
      { score: 100 },
    ],
  },

  fixtures: [
    {
      name: "no-history",
      evidence: { commit_history: { available: false, commits: [] } },
      expect: { reading: { kind: "na", reason: "no git history available" }, score: null },
    },
    {
      name: "all-conventional",
      evidence: {
        commit_history: {
          available: true,
          commits: [
            { sha: "a", subject: "feat(x): add y", authorEmail: "a@b" },
            { sha: "b", subject: "fix: bug", authorEmail: "a@b" },
            { sha: "c", subject: "docs: readme", authorEmail: "a@b" },
            { sha: "d", subject: "chore: bump deps", authorEmail: "a@b" },
          ],
        },
      },
      expect: { reading: { kind: "magnitude", value: 100, unit: "%" }, score: 100 },
    },
    {
      name: "mixed-style",
      evidence: {
        commit_history: {
          available: true,
          commits: [
            { sha: "a", subject: "feat: x", authorEmail: "a@b" },
            { sha: "b", subject: "Added thing", authorEmail: "a@b" },
            { sha: "c", subject: "fix bug", authorEmail: "a@b" },
            { sha: "d", subject: "fix: y", authorEmail: "a@b" },
          ],
        },
      },
      expect: { reading: { kind: "magnitude", value: 50, unit: "%" }, score: 50 },
    },
  ],
});
