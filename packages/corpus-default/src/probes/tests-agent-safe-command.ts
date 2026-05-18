import type { InventoryItem } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const AGENT_SAFE_TEST_SCRIPTS = ["test:agent", "test:unit", "test:smoke", "test:fast"] as const;
const E2E_TEST_HINT = /\b(playwright|cypress|testcafe|webdriver|selenium|detox|e2e)\b/i;

export default defineProbe({
  id: "tests.agent-safe-command",
  version: "1.0.0",
  dimensions: [
    { id: "feedback", weight: 1 },
    { id: "latency", weight: 0.5 },
  ],
  tier: "static",
  evidence: ["node_package"],

  rationale: `
    Executed probes should not surprise a repo by running hundreds of browser
    tests. For Node projects, repofit prefers fast agent-safe scripts
    (test:agent, test:unit, test:smoke, test:fast) before npm test. If npm
    test looks like a full e2e suite, this probe asks the repo to expose a
    smaller verification command or configure toolchain.commands.test.
  `,

  remediation:
    "Add a fast verification script such as `test:agent`, `test:unit`, `test:smoke`, or `test:fast`, and keep full browser/e2e suites under `test:e2e` or an explicit CI-only command. Alternatively set `toolchain.commands.test` in `repofit.config.json` to the exact command repofit should run in executed mode.",

  async detect(ev) {
    if (!ev.node_package.present) return { kind: "na", reason: "no package.json" };

    const scripts = ev.node_package.scripts ?? {};
    const hasSafe = AGENT_SAFE_TEST_SCRIPTS.some((script) => hasScript(scripts, script));
    const test = scripts.test ?? "";
    const items: InventoryItem[] = [];

    if (!hasSafe && E2E_TEST_HINT.test(test)) {
      items.push({
        location: { path: "package.json#scripts.test" },
        severity: "warn",
        message:
          "npm test looks e2e-heavy; add test:agent/test:unit/test:smoke or configure toolchain.commands.test",
      });
    }

    return { kind: "inventory", items };
  },

  score: {
    kind: "inventory",
    severityWeights: { info: 1, warn: 3, error: 10 },
    bands: [{ upTo: 0, score: 100 }, { upTo: 3, score: 70 }, { score: 0 }],
  },

  fixtures: [
    {
      name: "no-package-json",
      evidence: { node_package: { present: false } },
      expect: { reading: { kind: "na", reason: "no package.json" }, score: null },
    },
    {
      name: "safe-test-script-present",
      evidence: {
        node_package: {
          present: true,
          scripts: { test: "playwright test", "test:agent": "vitest run" },
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "normal-npm-test",
      evidence: { node_package: { present: true, scripts: { test: "vitest run" } } },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "e2e-only-npm-test",
      evidence: { node_package: { present: true, scripts: { test: "playwright test" } } },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "package.json#scripts.test" },
              severity: "warn",
              message:
                "npm test looks e2e-heavy; add test:agent/test:unit/test:smoke or configure toolchain.commands.test",
            },
          ],
        },
        score: 70,
      },
    },
  ],
});

function hasScript(scripts: Record<string, string>, name: string): boolean {
  return typeof scripts[name] === "string" && scripts[name].trim().length > 0;
}
