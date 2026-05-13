import { defineProbe } from "@esbenwiberg/repofit/sdk";
import { LATENCY_BANDS } from "./_shared/latency-bands.js";

export default defineProbe({
  id: "latency.typecheck",
  version: "1.0.0",
  dimensions: [{ id: "latency", weight: 1 }],
  tier: "executed",
  evidence: ["node_package", "files", "commands"],

  rationale: `
    Typecheck wall-clock — preferably from a project-local typecheck
    script, falling back to a vanilla \`tsc --noEmit\` when a tsconfig
    is present. N/A on repos without TS configuration.
  `,

  remediation:
    "Speed up typecheck: use TS project references with incremental builds (`composite: true`, `incremental: true`), narrow `include`/`exclude` to source files only, skip lib checks (`skipLibCheck: true` if not already). For monorepos, set up referenced subprojects so unchanged packages aren't re-typechecked.",

  async detect(ev) {
    if (!ev.node_package.present && !ev.files.has("tsconfig.json")) {
      return { kind: "na", reason: "no TS configuration" };
    }
    const scripted =
      ev.node_package.present &&
      typeof ev.node_package.scripts.typecheck === "string" &&
      ev.node_package.scripts.typecheck.trim().length > 0;

    let argv: string[];
    if (scripted) {
      argv = ["npm", "run", "typecheck", "--silent"];
    } else if (ev.files.has("tsconfig.json")) {
      argv = ["npx", "--no-install", "tsc", "--noEmit"];
    } else {
      return { kind: "na", reason: "no typecheck script and no tsconfig.json" };
    }

    const run = await ev.commands.run({ argv, warmup: 1, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "typecheck timed out" };
    if (run.exitCode !== 0) return { kind: "na", reason: `typecheck exited ${run.exitCode}` };
    return { kind: "magnitude", value: run.durationMs, unit: "ms" };
  },

  score: {
    kind: "magnitude",
    direction: "negative",
    bands: LATENCY_BANDS,
  },

  fixtures: [
    {
      name: "no-ts-config",
      evidence: { node_package: { present: true, scripts: {} } },
      expect: {
        reading: { kind: "na", reason: "no typecheck script and no tsconfig.json" },
        score: null,
      },
    },
    {
      name: "scripted-typecheck",
      evidence: {
        node_package: { present: true, scripts: { typecheck: "tsc --noEmit" } },
        commands: [
          { argv: ["npm", "run", "typecheck", "--silent"], exitCode: 0, durationMs: 6500 },
        ],
      },
      expect: { reading: { kind: "magnitude", value: 6500, unit: "ms" }, score: 100 },
    },
    {
      name: "tsconfig-fallback",
      evidence: {
        node_package: { present: false },
        files: ["tsconfig.json"],
        commands: [
          { argv: ["npx", "--no-install", "tsc", "--noEmit"], exitCode: 0, durationMs: 11_000 },
        ],
      },
      expect: { reading: { kind: "magnitude", value: 11_000, unit: "ms" }, score: 80 },
    },
  ],
});
