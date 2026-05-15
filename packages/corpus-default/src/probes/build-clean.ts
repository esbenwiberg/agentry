import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "build.clean",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["node_package", "commands"],

  rationale: `
    A configured build that doesn't currently succeed is a half-set
    gate. This runs the project's \`build\` script and reports clean
    only when it exits zero. A red build means the agent can't verify
    its diff still integrates — module resolution, bundler config, and
    output emission all live downstream of typecheck.
  `,

  remediation:
    "Run `npm run build` and fix every reported error until it exits clean. Then add a pre-commit or CI gate so the tree stays buildable. A broken build that nobody notices is a guarantee the next agent — or the next human — will spend their first hour debugging it.",

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const script = ev.node_package.scripts.build;
    if (typeof script !== "string" || script.trim().length === 0) {
      return { kind: "na", reason: "no build script" };
    }
    const run = await ev.commands.run({
      argv: ["npm", "run", "build", "--silent"],
      timeoutMs: 300_000,
    });
    if (run.timedOut) return { kind: "na", reason: "build command timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "no-build-script",
      evidence: { node_package: { present: true, scripts: {} } },
      expect: { reading: { kind: "na", reason: "no build script" }, score: null },
    },
    {
      name: "build-clean",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc" } },
        commands: [{ argv: ["npm", "run", "build", "--silent"], exitCode: 0, durationMs: 3200 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "build-broken",
      evidence: {
        node_package: { present: true, scripts: { build: "tsc" } },
        commands: [{ argv: ["npm", "run", "build", "--silent"], exitCode: 2, durationMs: 1800 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
