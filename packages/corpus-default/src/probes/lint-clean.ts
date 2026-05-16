import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "lint.clean",
  version: "2.0.0",
  dimensions: [
    { id: "feedback", weight: 1 },
    { id: "consistency", weight: 0.5 },
  ],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    A configured linter that the codebase doesn't actually pass is a
    half-set gate. This runs the lint command for the primary stack
    (Node \`npm run lint\`, Python \`ruff check .\`, .NET
    \`dotnet format --verify-no-changes\`, Go \`golangci-lint run\` or
    \`go vet ./...\`) and reports clean only when it exits zero.
  `,

  remediation:
    "Run the lint command for your stack and fix or autofix every warning until it exits clean. Add a pre-commit hook or CI gate so the tree stays green. A linter that's configured but ignored is worse than no linter — it trains everyone to ignore warnings.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.lint;
    if (!cmd) {
      return {
        kind: "na",
        reason:
          "no lint command — declare commands.lint in repofit.config.json, or configure a lint tool for your stack (e.g. ruff, golangci-lint, npm run lint)",
      };
    }
    const run = await ev.commands.run({ argv: cmd.argv, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "lint command timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-lint-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: {
          kind: "na",
          reason:
            "no lint command — declare commands.lint in repofit.config.json, or configure a lint tool for your stack (e.g. ruff, golangci-lint, npm run lint)",
        },
        score: null,
      },
    },
    {
      name: "node-lint-clean",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            lint: { source: "node", argv: ["npm", "run", "lint", "--silent"] },
          },
        },
        commands: [{ argv: ["npm", "run", "lint", "--silent"], exitCode: 0, durationMs: 500 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-lint-dirty",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            lint: { source: "node", argv: ["npm", "run", "lint", "--silent"] },
          },
        },
        commands: [{ argv: ["npm", "run", "lint", "--silent"], exitCode: 1, durationMs: 500 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "python-ruff-clean",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: {
            lint: { source: "python", argv: ["ruff", "check", "."] },
          },
        },
        commands: [{ argv: ["ruff", "check", "."], exitCode: 0, durationMs: 300 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "dotnet-format-dirty",
      evidence: {
        toolchain: {
          stacks: ["dotnet"],
          primary: "dotnet",
          commands: {
            lint: { source: "dotnet", argv: ["dotnet", "format", "--verify-no-changes"] },
          },
        },
        commands: [
          {
            argv: ["dotnet", "format", "--verify-no-changes"],
            exitCode: 2,
            durationMs: 2000,
          },
        ],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
