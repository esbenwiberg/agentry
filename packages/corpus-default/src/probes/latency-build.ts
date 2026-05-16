import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { LATENCY_BANDS } from "./_shared/latency-bands.js";

export default defineProbe({
  id: "latency.build",
  version: "2.0.0",
  dimensions: [{ id: "latency", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Build wall-clock gates how often an agent can verify integration
    locally. Runs the build command for the primary stack with one
    warmup. Bands match the test-suite probe: <10s great, >300s
    actively painful.
  `,

  remediation:
    "Make the build fast enough that the agent runs it after every change. Incremental builds, fast bundlers (esbuild/swc), parallel package builds in a monorepo. Aim for under 30 seconds on a clean machine; over 5 minutes is a productivity tax that compounds every cycle.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.build;
    if (!cmd) return { kind: "na", reason: "no build command for the primary stack" };
    const run = await ev.commands.run({ argv: cmd.argv, warmup: 1, timeoutMs: 600_000 });
    if (run.timedOut) return { kind: "na", reason: "build command timed out" };
    if (run.exitCode !== 0) return { kind: "na", reason: `build exited ${run.exitCode}` };
    return { kind: "magnitude", value: run.durationMs, unit: "ms" };
  },

  score: { kind: "magnitude", direction: "negative", bands: LATENCY_BANDS },

  fixtures: [
    {
      name: "no-build-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: { kind: "na", reason: "no build command for the primary stack" },
        score: null,
      },
    },
    {
      name: "fast-node-build",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            build: { source: "node", argv: ["npm", "run", "build", "--silent"] },
          },
        },
        commands: [{ argv: ["npm", "run", "build", "--silent"], exitCode: 0, durationMs: 3200 }],
      },
      expect: { reading: { kind: "magnitude", value: 3200, unit: "ms" }, score: 100 },
    },
  ],
});
