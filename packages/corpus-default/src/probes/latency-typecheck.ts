import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { LATENCY_BANDS } from "./_shared/latency-bands.js";

export default defineProbe({
  id: "latency.typecheck",
  version: "2.0.0",
  dimensions: [{ id: "latency", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Typecheck wall-clock — runs the typecheck command for the primary
    stack (Node typecheck script or \`tsc --noEmit\`, Python
    \`mypy .\`). N/A on stacks where typecheck is baked into build
    (.NET, Go) or no type-checker is configured.
  `,

  remediation:
    "Speed up typecheck: TS project references with incremental builds, narrow `include`/`exclude`, `skipLibCheck`. For mypy: enable the cache, narrow `files`, use `--install-types --non-interactive` to avoid prompts.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.typecheck;
    if (!cmd) return { kind: "na", reason: "no typecheck command for the primary stack" };
    const run = await ev.commands.run({ argv: cmd.argv, warmup: 1, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "typecheck timed out" };
    if (run.exitCode !== 0) return { kind: "na", reason: `typecheck exited ${run.exitCode}` };
    return { kind: "magnitude", value: run.durationMs, unit: "ms" };
  },

  score: { kind: "magnitude", direction: "negative", bands: LATENCY_BANDS },

  fixtures: [
    {
      name: "no-typecheck-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: { kind: "na", reason: "no typecheck command for the primary stack" },
        score: null,
      },
    },
    {
      name: "fast-node-typecheck",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            typecheck: { source: "node", argv: ["npm", "run", "typecheck", "--silent"] },
          },
        },
        commands: [
          { argv: ["npm", "run", "typecheck", "--silent"], exitCode: 0, durationMs: 6500 },
        ],
      },
      expect: { reading: { kind: "magnitude", value: 6500, unit: "ms" }, score: 100 },
    },
    {
      name: "tsc-fallback",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: { typecheck: { source: "node", argv: ["npx", "tsc", "--noEmit"] } },
        },
        commands: [{ argv: ["npx", "tsc", "--noEmit"], exitCode: 0, durationMs: 11_000 }],
      },
      expect: { reading: { kind: "magnitude", value: 11_000, unit: "ms" }, score: 80 },
    },
  ],
});
