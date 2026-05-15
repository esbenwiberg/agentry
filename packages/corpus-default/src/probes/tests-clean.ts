import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "tests.clean",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["node_package", "commands"],

  rationale: `
    A configured test runner only helps an agent verify itself if the
    suite is actually green. This runs the project's \`test\` script and
    reports clean only when it exits zero. A red suite is a feedback
    loop the agent can't trust — every change looks like it broke
    something even when it didn't.
  `,

  remediation:
    "Run `npm test` (or the equivalent for your stack) and fix every failing test. If a test is flaky, mark it explicitly (`test.skip`/`it.skip` with a TODO and link) rather than ignoring CI red — an agent reading the repo can't tell the difference between a flake and a real regression. Add a pre-commit or CI gate so the tree stays green.",

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const script = ev.node_package.scripts.test;
    if (typeof script !== "string" || script.trim().length === 0) {
      return { kind: "na", reason: "no test script" };
    }
    const run = await ev.commands.run({
      argv: ["npm", "test", "--silent"],
      timeoutMs: 300_000,
    });
    if (run.timedOut) return { kind: "na", reason: "test command timed out" };
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
      name: "no-test-script",
      evidence: { node_package: { present: true, scripts: {} } },
      expect: { reading: { kind: "na", reason: "no test script" }, score: null },
    },
    {
      name: "tests-clean",
      evidence: {
        node_package: { present: true, scripts: { test: "vitest run" } },
        commands: [{ argv: ["npm", "test", "--silent"], exitCode: 0, durationMs: 4500 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "tests-failing",
      evidence: {
        node_package: { present: true, scripts: { test: "vitest run" } },
        commands: [{ argv: ["npm", "test", "--silent"], exitCode: 1, durationMs: 4500 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
