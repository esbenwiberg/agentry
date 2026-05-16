import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { LATENCY_BANDS } from "./_shared/latency-bands.js";

export default defineProbe({
  id: "latency.test-suite",
  version: "2.0.0",
  dimensions: [{ id: "latency", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Wall-clock of the test suite is the wall-clock of an agent's
    verification cycle. Slow tests turn into a slow agent. Runs the
    test command for the primary stack twice (warm-up + measured) so
    steady-state is what's reported, not first-run compile cost.
  `,

  remediation:
    "Speed up the test suite: parallelize (Vitest/Jest/pytest default to it), separate the fast unit pass from slow integration/e2e tiers, mock external services, share test setup. The fast pass should finish in under a minute. Slower tiers can run in CI but should be opt-in locally.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.test;
    if (!cmd) return { kind: "na", reason: "no test command for the primary stack" };
    const run = await ev.commands.run({ argv: cmd.argv, warmup: 1, timeoutMs: 600_000 });
    if (run.timedOut) return { kind: "na", reason: "test command timed out" };
    if (run.exitCode !== 0) return { kind: "na", reason: `test exited ${run.exitCode}` };
    return { kind: "magnitude", value: run.durationMs, unit: "ms" };
  },

  score: { kind: "magnitude", direction: "negative", bands: LATENCY_BANDS },

  fixtures: [
    {
      name: "no-test-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: { kind: "na", reason: "no test command for the primary stack" },
        score: null,
      },
    },
    {
      name: "fast-suite",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: { test: { source: "node", argv: ["npm", "test", "--silent"] } },
        },
        commands: [{ argv: ["npm", "test", "--silent"], exitCode: 0, durationMs: 4500 }],
      },
      expect: { reading: { kind: "magnitude", value: 4500, unit: "ms" }, score: 100 },
    },
    {
      name: "medium-suite",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: { test: { source: "node", argv: ["npm", "test", "--silent"] } },
        },
        commands: [{ argv: ["npm", "test", "--silent"], exitCode: 0, durationMs: 60_000 }],
      },
      expect: { reading: { kind: "magnitude", value: 60_000, unit: "ms" }, score: 50 },
    },
    {
      name: "test-fails",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: { test: { source: "python", argv: ["pytest"] } },
        },
        commands: [{ argv: ["pytest"], exitCode: 1, durationMs: 1200 }],
      },
      expect: { reading: { kind: "na", reason: "test exited 1" }, score: null },
    },
  ],
});
