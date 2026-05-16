import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { LATENCY_BANDS } from "./_shared/latency-bands.js";

export default defineProbe({
  id: "latency.lint",
  version: "2.0.0",
  dimensions: [{ id: "latency", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Lint should be the cheapest gate — agents rerun it many times per
    task. A slow linter pushes them to skip the loop. Bands match the
    rest of the executed-latency family.
  `,

  remediation:
    "Switch to a fast linter or trim the ruleset. Biome (Rust-based) and ruff (also Rust) are dramatically faster than ESLint / flake8. Cache lint results when possible. Lint should finish in seconds — if it's slow, agents skip it.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.lint;
    if (!cmd) return { kind: "na", reason: "no lint command for the primary stack" };
    const run = await ev.commands.run({ argv: cmd.argv, warmup: 1, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "lint command timed out" };
    if (run.exitCode !== 0) return { kind: "na", reason: `lint exited ${run.exitCode}` };
    return { kind: "magnitude", value: run.durationMs, unit: "ms" };
  },

  score: { kind: "magnitude", direction: "negative", bands: LATENCY_BANDS },

  fixtures: [
    {
      name: "no-lint-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: { kind: "na", reason: "no lint command for the primary stack" },
        score: null,
      },
    },
    {
      name: "fast-node-lint",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: { lint: { source: "node", argv: ["npm", "run", "lint", "--silent"] } },
        },
        commands: [{ argv: ["npm", "run", "lint", "--silent"], exitCode: 0, durationMs: 800 }],
      },
      expect: { reading: { kind: "magnitude", value: 800, unit: "ms" }, score: 100 },
    },
  ],
});
