import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "types.configured",
  version: "2.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["toolchain"],

  rationale: `
    Type checking is a fast, structural feedback loop — an agent that can
    run a typechecker catches whole categories of mistakes before tests
    even run. .NET and Go bake typechecking into the build, so detecting
    a build/test toolchain there is enough. For Node and Python we look
    for an explicit type-checker (\`tsc --noEmit\` / a 'typecheck' script,
    or \`mypy\` configured in pyproject).
  `,

  remediation:
    'Add a typecheck loop for your stack. Node/TS: `npm install -D typescript`, add `tsconfig.json` with `"strict": true`, and `"typecheck": "tsc --noEmit"` in scripts. Python: add `[tool.mypy]` (or pyright) to `pyproject.toml`. .NET and Go enforce types during build — make sure `build.configured` passes.',

  async detect(ev) {
    const tc = ev.toolchain;
    // dotnet and go bake typechecking into `dotnet build` / `go build`.
    if (tc.primary === "dotnet" || tc.primary === "go") {
      return { kind: "predicate", value: true };
    }
    // node and python need an explicit type-checker.
    if (tc.commands.typecheck) {
      return { kind: "predicate", value: true };
    }
    return { kind: "predicate", value: false };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "node-with-typecheck-command",
      evidence: {
        toolchain: {
          stacks: ["node"],
          primary: "node",
          commands: {
            typecheck: { source: "node", argv: ["npm", "run", "typecheck", "--silent"] },
          },
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "node-without-typecheck",
      evidence: { toolchain: { stacks: ["node"], primary: "node", commands: {} } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "python-with-mypy",
      evidence: {
        toolchain: {
          stacks: ["python"],
          primary: "python",
          commands: { typecheck: { source: "python", argv: ["mypy", "."] } },
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "dotnet-always-typed",
      evidence: { toolchain: { stacks: ["dotnet"], primary: "dotnet", commands: {} } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "go-always-typed",
      evidence: { toolchain: { stacks: ["go"], primary: "go", commands: {} } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "no-stack",
      evidence: { toolchain: { primary: null } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
