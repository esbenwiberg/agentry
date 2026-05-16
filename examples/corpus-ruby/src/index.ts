// Example custom corpus: adds Ruby support to repofit.
//
// What it does:
//   1. SHADOWS the stock `lint.clean` probe with a Ruby-aware one that runs
//      `bundle exec rubocop` when a Gemfile is present.
//   2. ADDS a new `rspec.clean` probe in the feedback dimension.
//
// How to use it (in your repo):
//   npm install --save-dev @example/repofit-corpus-ruby
//   # in repofit.config.json:
//   {
//     "corpus": [
//       { "package": "@esbenwiberg/corpus-default", "version": "1.1.0" },
//       { "package": "@example/repofit-corpus-ruby", "version": "0.1.0" }
//     ]
//   }
//
// Later entries override earlier ones on probe id, so the Ruby `lint.clean`
// wins. The stock probe's score for that id is replaced cleanly — no fork.

import { defineProbe } from "@esbenwiberg/repofit/sdk";

const GEMFILE_RE = /(?:^|\/)Gemfile$/;

/**
 * Override: lint.clean for Ruby repos.
 *
 * Runs `bundle exec rubocop` when a Gemfile is committed. If no Gemfile is
 * present we return n/a — the user almost certainly didn't mean to load
 * this corpus on a non-Ruby repo, but we don't penalise them for it.
 */
const lintCleanRuby = defineProbe({
  id: "lint.clean",
  version: "1.0.0",
  dimensions: [
    { id: "feedback", weight: 1 },
    { id: "consistency", weight: 0.5 },
  ],
  tier: "executed",
  evidence: ["size_stats", "commands"],

  rationale: `
    Runs RuboCop on the Ruby tree and reports clean only when it exits zero.
    Shadows the stock multi-stack lint.clean probe — for repos that load
    both corpora, the Ruby one wins on probe id.
  `,

  remediation:
    "Run `bundle exec rubocop --autocorrect` and commit the result. Add the same command to your CI so the tree stays clean. If RuboCop's defaults are too noisy, configure them in `.rubocop.yml` — don't disable cops blindly.",

  async detect(ev) {
    const hasGemfile = ev.size_stats.files.some((f) => GEMFILE_RE.test(f.path));
    if (!hasGemfile) return { kind: "na", reason: "no Gemfile — not a Ruby repo" };
    const run = await ev.commands.run({
      argv: ["bundle", "exec", "rubocop"],
      timeoutMs: 300_000,
    });
    if (run.timedOut) return { kind: "na", reason: "rubocop timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-gemfile",
      evidence: {
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: {
        reading: { kind: "na", reason: "no Gemfile — not a Ruby repo" },
        score: null,
      },
    },
    {
      name: "rubocop-clean",
      evidence: {
        size_stats: {
          files: [{ path: "Gemfile", bytes: 100, lines: 10, depth: 0 }],
          totalBytes: 100,
          totalFiles: 1,
          source: "git-ls-files",
        },
        commands: [{ argv: ["bundle", "exec", "rubocop"], exitCode: 0, durationMs: 1500 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "rubocop-dirty",
      evidence: {
        size_stats: {
          files: [{ path: "Gemfile", bytes: 100, lines: 10, depth: 0 }],
          totalBytes: 100,
          totalFiles: 1,
          source: "git-ls-files",
        },
        commands: [{ argv: ["bundle", "exec", "rubocop"], exitCode: 1, durationMs: 1500 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});

/**
 * New probe: rspec.clean. Not in the stock corpus.
 *
 * Runs `bundle exec rspec` when a `spec/` directory is present. Demonstrates
 * adding a stack-specific probe alongside the override above.
 */
const rspecClean = defineProbe({
  id: "rspec.clean",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["size_stats", "commands"],

  rationale: "Runs RSpec and reports clean only when it exits zero.",

  remediation:
    "Fix the failing specs. If you don't have specs yet, write one happy-path spec per public class — even a smoke test beats no test.",

  async detect(ev) {
    const hasSpecDir = ev.size_stats.files.some((f) => f.path.startsWith("spec/"));
    if (!hasSpecDir) return { kind: "na", reason: "no spec/ directory" };
    const run = await ev.commands.run({
      argv: ["bundle", "exec", "rspec"],
      timeoutMs: 600_000,
    });
    if (run.timedOut) return { kind: "na", reason: "rspec timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-spec-dir",
      evidence: {
        size_stats: { files: [], totalBytes: 0, totalFiles: 0, source: "git-ls-files" },
      },
      expect: { reading: { kind: "na", reason: "no spec/ directory" }, score: null },
    },
  ],
});

export const meta = { name: "@example/repofit-corpus-ruby", version: "0.1.0" };
export const probes = [lintCleanRuby, rspecClean];
// Re-use stock dimensions. A custom corpus that wants to define its own
// dimensions can export them here.
export const dimensions = [
  { id: "feedback", label: "Feedback", weight: 1 },
  { id: "consistency", label: "Consistency", weight: 1 },
];
export const fixers = [];
