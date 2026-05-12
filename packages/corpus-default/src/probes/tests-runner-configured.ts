import { defineProbe } from "@esbenwiberg/repofit/sdk";

const TEST_RUNNERS = [
  "vitest",
  "jest",
  "mocha",
  "ava",
  "node:test",
  "playwright",
  "@playwright/test",
];

export default defineProbe({
  id: "tests.runner-configured",
  version: "1.0.0",
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "static",
  evidence: ["node_package"],

  rationale: `
    An agent that can run tests can verify its own changes. Detecting a
    test runner — either as a devDependency or via a "test" npm script —
    is a cheap proxy for whether feedback is wired up at all.
  `,

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };
    const hasRunnerDep = TEST_RUNNERS.some((r) => r in ev.node_package.devDependencies);
    const hasTestScript =
      typeof ev.node_package.scripts.test === "string" &&
      ev.node_package.scripts.test.trim().length > 0 &&
      ev.node_package.scripts.test !== 'echo "Error: no test specified" && exit 1';
    return { kind: "predicate", value: hasRunnerDep || hasTestScript };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "vitest-devdep",
      evidence: { node_package: { present: true, devDependencies: { vitest: "^1.0.0" } } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "test-script-only",
      evidence: { node_package: { present: true, scripts: { test: "node --test" } } },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "npm-init-default-test-script",
      evidence: {
        node_package: {
          present: true,
          scripts: { test: 'echo "Error: no test specified" && exit 1' },
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "no-test-runner",
      evidence: { node_package: { present: true } },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
  ],
});
