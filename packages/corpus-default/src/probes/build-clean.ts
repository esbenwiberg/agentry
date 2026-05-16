import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "build.clean",
  version: "2.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    A configured build that doesn't actually pass is a half-set gate.
    This runs the build command for the primary stack
    (Node \`npm run build\`, Python \`python -m build\`,
    .NET \`dotnet build\`, Go \`go build ./...\`) and reports clean
    only when it exits zero.
  `,

  remediation:
    "Run the build command for your stack and fix the errors until it exits clean. A configured-but-broken build means an agent has no signal on whether its diff still compiles.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.build;
    if (!cmd) {
      return {
        kind: "na",
        reason:
          "no build command — declare commands.build in repofit.config.json, or configure a build for your stack (e.g. an npm 'build' script, a [build-system] in pyproject.toml)",
      };
    }
    const run = await ev.commands.run({ argv: cmd.argv, timeoutMs: 600_000 });
    if (run.timedOut) return { kind: "na", reason: "build command timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-build-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: {
          kind: "na",
          reason:
            "no build command — declare commands.build in repofit.config.json, or configure a build for your stack (e.g. an npm 'build' script, a [build-system] in pyproject.toml)",
        },
        score: null,
      },
    },
    {
      name: "node-build-clean",
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
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "go-build-fails",
      evidence: {
        toolchain: {
          stacks: ["go"],
          primary: "go",
          commands: {
            build: { source: "go", argv: ["go", "build", "./..."] },
          },
        },
        commands: [{ argv: ["go", "build", "./..."], exitCode: 1, durationMs: 1000 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
