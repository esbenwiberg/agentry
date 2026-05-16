import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "types.clean",
  version: "2.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "executed",
  evidence: ["toolchain", "commands"],

  rationale: `
    Type errors that ship are a clear gate failure. This runs the
    typecheck command for the primary stack (Node typecheck script or
    \`tsc --noEmit\`, Python \`mypy .\`) and reports clean only on
    exit zero. N/A on stacks where typecheck is baked into build
    (.NET, Go) or no type-checker is configured.
  `,

  remediation:
    "Run the typecheck for your stack and fix every reported error. Don't suppress with `@ts-ignore` / `# type: ignore` casts without justification — those are a tax the agent pays every time it tries to reason about the surrounding code. Add a pre-commit hook or CI gate so the tree stays type-clean.",

  async detect(ev) {
    const cmd = ev.toolchain.commands.typecheck;
    if (!cmd) {
      return {
        kind: "na",
        reason:
          "no typecheck command — declare commands.typecheck in repofit.config.json, or configure a type-checker for your stack (e.g. tsc, mypy)",
      };
    }
    const run = await ev.commands.run({ argv: cmd.argv, timeoutMs: 300_000 });
    if (run.timedOut) return { kind: "na", reason: "typecheck timed out" };
    return { kind: "predicate", value: run.exitCode === 0 };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-typecheck-command",
      evidence: { toolchain: { primary: null } },
      expect: {
        reading: {
          kind: "na",
          reason:
            "no typecheck command — declare commands.typecheck in repofit.config.json, or configure a type-checker for your stack (e.g. tsc, mypy)",
        },
        score: null,
      },
    },
    {
      name: "node-tsc-clean",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            typecheck: { source: "node", argv: ["npm", "run", "typecheck", "--silent"] },
          },
        },
        commands: [
          { argv: ["npm", "run", "typecheck", "--silent"], exitCode: 0, durationMs: 4500 },
        ],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "python-mypy-dirty",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: { typecheck: { source: "python", argv: ["mypy", "."] } },
        },
        commands: [{ argv: ["mypy", "."], exitCode: 1, durationMs: 2000 }],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
