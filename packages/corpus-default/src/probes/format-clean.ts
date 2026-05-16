import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "format.clean",
  version: "2.0.0",
  dimensions: [
    { id: "consistency", weight: 1 },
    { id: "feedback", weight: 0.3 },
  ],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Formatter configured but the codebase doesn't match it is a noisy
    rebase magnet. This invokes the format-check command for the
    primary stack (Node format:check script, Python
    \`ruff format --check .\`, Go \`gofmt -l .\`) and reports clean
    only on exit zero. N/A on .NET where \`dotnet format\` already
    runs as the lint command.
  `,

  remediation:
    "Run your formatter and commit the result. Add a pre-commit hook or a CI gate that re-checks formatting so the tree stays clean. A dirty formatter is just noisy diffs and rebase pain.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.format;
    if (!cmd) {
      return {
        kind: "na",
        reason:
          "no format-check command — declare commands.format in repofit.config.json, or configure a formatter for your stack (e.g. ruff format, gofmt, an npm 'format:check' script)",
      };
    }
    const run = await ev.commands.run({ argv: cmd.argv, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "format command timed out" };
    // gofmt is gnarly: exits 0 even when files need formatting, but prints them.
    // Treat any non-empty stdout from `gofmt -l` as "dirty".
    if (cmd.argv[0] === "gofmt" && run.exitCode === 0) {
      return { kind: "predicate", value: run.stdout.trim().length === 0 };
    }
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-format-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: {
          kind: "na",
          reason:
            "no format-check command — declare commands.format in repofit.config.json, or configure a formatter for your stack (e.g. ruff format, gofmt, an npm 'format:check' script)",
        },
        score: null,
      },
    },
    {
      name: "node-format-clean",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            format: { source: "node", argv: ["npm", "run", "format:check", "--silent"] },
          },
        },
        commands: [
          { argv: ["npm", "run", "format:check", "--silent"], exitCode: 0, durationMs: 300 },
        ],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "python-ruff-format-dirty",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: {
            format: { source: "python", argv: ["ruff", "format", "--check", "."] },
          },
        },
        commands: [{ argv: ["ruff", "format", "--check", "."], exitCode: 1, durationMs: 200 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "go-gofmt-clean",
      evidence: {
        toolchain: {
          stacks: ["go"],
          primary: "go",
          commands: { format: { source: "go", argv: ["gofmt", "-l", "."] } },
        },
        commands: [{ argv: ["gofmt", "-l", "."], exitCode: 0, durationMs: 150, stdout: "" }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "go-gofmt-dirty",
      evidence: {
        toolchain: {
          stacks: ["go"],
          primary: "go",
          commands: { format: { source: "go", argv: ["gofmt", "-l", "."] } },
        },
        commands: [
          {
            argv: ["gofmt", "-l", "."],
            exitCode: 0,
            durationMs: 150,
            stdout: "main.go\n",
          },
        ],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
