import { defineProbe } from "@esbenwiberg/repofit/sdk";

const SCAN_SCRIPT_CANDIDATES = [
  "secrets",
  "secret:scan",
  "secrets:scan",
  "secrets:check",
  "secret-scan",
  "scan:secrets",
];

export default defineProbe({
  id: "secrets.scan-clean",
  version: "1.0.0",
  dimensions: [{ id: "safety", weight: 1 }],
  tier: "executed",
  evidence: ["node_package", "commands"],

  rationale: `
    A configured secret scanner only helps if it's actually run. This
    probe runs the project's secret-scan script and reports clean only
    when it exits zero — meaning no secrets detected in the working
    tree. Pairs with \`secrets.precommit-scan-configured\`: configured
    tells you the gate exists, clean tells you the tree currently
    passes it. N/A if no scan script is exposed (the precommit hook
    alone can't be invoked uniformly across tools).
  `,

  remediation:
    'Expose your secret scanner as a runnable script so the gate can be invoked outside the precommit hook. Node: add `"secrets": "gitleaks detect --no-banner --no-git"` (or the equivalent for `trufflehog`, `detect-secrets`, `secretlint`) to `package.json` scripts. Then run it and clean up any findings — a flagged secret in the working tree is the only thing that matters here.',

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const scripts = ev.node_package.scripts;
    const scriptName = SCAN_SCRIPT_CANDIDATES.find(
      (name) => typeof scripts[name] === "string" && scripts[name].trim().length > 0,
    );
    if (!scriptName) {
      return { kind: "na", reason: "no secrets scan script" };
    }
    const run = await ev.commands.run({
      argv: ["npm", "run", scriptName, "--silent"],
      timeoutMs: 300_000,
    });
    if (run.timedOut) return { kind: "na", reason: "secrets scan timed out" };
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
      name: "no-scan-script",
      evidence: { node_package: { present: true, scripts: { test: "vitest" } } },
      expect: { reading: { kind: "na", reason: "no secrets scan script" }, score: null },
    },
    {
      name: "scan-clean",
      evidence: {
        node_package: {
          present: true,
          scripts: { secrets: "gitleaks detect --no-banner --no-git" },
        },
        commands: [{ argv: ["npm", "run", "secrets", "--silent"], exitCode: 0, durationMs: 1200 }],
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "scan-finds-leak",
      evidence: {
        node_package: {
          present: true,
          scripts: { "secrets:scan": "gitleaks detect --no-banner --no-git" },
        },
        commands: [
          { argv: ["npm", "run", "secrets:scan", "--silent"], exitCode: 1, durationMs: 1500 },
        ],
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
