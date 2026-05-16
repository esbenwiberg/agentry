import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "tests.clean",
  version: "2.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    A configured test runner only helps an agent verify itself if the
    suite is actually green. This runs the test command for the primary
    stack (Node \`npm test\`, Python \`pytest\`, .NET \`dotnet test\`,
    Go \`go test ./...\`) and reports clean only when it exits zero.
    A red suite is a feedback loop the agent can't trust — every change
    looks like it broke something even when it didn't.
  `,

  remediation:
    "Run the test command for your stack and fix every failing test. If a test is flaky, mark it explicitly (`test.skip`/`it.skip` with a TODO and link) rather than ignoring CI red — an agent reading the repo can't tell the difference between a flake and a real regression. Add a pre-commit or CI gate so the tree stays green.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.test;
    if (!cmd) {
      return {
        kind: "na",
        reason:
          "no test command — declare commands.test in repofit.config.json, or configure a test runner for your stack (e.g. pytest, an npm 'test' script)",
      };
    }
    const run = await ev.commands.run({ argv: cmd.argv, timeoutMs: 600_000 });
    if (run.timedOut) return { kind: "na", reason: "test command timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-test-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: {
          kind: "na",
          reason:
            "no test command — declare commands.test in repofit.config.json, or configure a test runner for your stack (e.g. pytest, an npm 'test' script)",
        },
        score: null,
      },
    },
    {
      name: "node-tests-clean",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: { test: { source: "node", argv: ["npm", "test", "--silent"] } },
        },
        commands: [{ argv: ["npm", "test", "--silent"], exitCode: 0, durationMs: 4500 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "python-pytest-failing",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: { test: { source: "python", argv: ["pytest"] } },
        },
        commands: [{ argv: ["pytest"], exitCode: 1, durationMs: 3000 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
