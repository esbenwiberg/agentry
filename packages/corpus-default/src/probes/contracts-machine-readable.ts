import type { InventoryItem } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const CONTRACT_PATTERNS = [
  /(?:^|\/)(?:openapi|swagger)\.(?:ya?ml|json)$/i,
  /(?:^|\/)[^/]+\.proto$/i,
  /(?:^|\/)(?:schema|[^/]+)\.graphql$/i,
  /(?:^|\/)[^/]+\.schema\.json$/i,
  /(?:^|\/)prisma\/schema\.prisma$/i,
  /(?:^|\/)db\/schema\.(?:ts|js)$/i,
  /(?:^|\/)src\/schema\.(?:ts|js)$/i,
];

const TEST_FILE = /(?:\.test\.|\.spec\.|__tests__|^tests?\/|^e2e\/)/i;
const GENERATION_OR_VALIDATION_SCRIPT =
  /\b(openapi|swagger|proto|buf|graphql|prisma|drizzle|schema|contract)\b/i;

export default defineProbe({
  id: "contracts.machine-readable",
  version: "1.0.0",
  dimensions: [
    { id: "context", weight: 1 },
    { id: "feedback", weight: 0.7 },
  ],
  tier: "static",
  evidence: ["size_stats", "node_package"],

  rationale: `
    Agents do better when boundary facts live in machine-readable contracts:
    OpenAPI, GraphQL, protobuf, JSON Schema, Prisma/DB schema, or equivalent.
    This probe does not require every repo to expose an API; it activates when
    contract files exist and then checks for tests or validation/generation
    scripts that keep those contracts honest.
  `,

  remediation:
    "Keep API, message, and data-shape contracts in machine-readable files, then wire them to tests or generation/validation scripts. A contract that is not checked can drift into decorative documentation.",

  async detect(ev) {
    const paths = ev.size_stats.files.filter((f) => !f.generated).map((f) => f.path);
    const contracts = paths
      .filter((p) => CONTRACT_PATTERNS.some((pattern) => pattern.test(p)))
      .sort();

    if (contracts.length === 0) {
      return { kind: "na", reason: "no machine-readable contract files detected" };
    }

    const testPaths = paths.filter((p) => TEST_FILE.test(p));
    const scripts = ev.node_package.present ? Object.values(ev.node_package.scripts ?? {}) : [];
    const hasContractScript = scripts.some((script) =>
      GENERATION_OR_VALIDATION_SCRIPT.test(script),
    );

    const items: InventoryItem[] = [];
    for (const contract of contracts) {
      const stem = contractStem(contract);
      const hasNearbyTest = testPaths.some((p) => p.toLowerCase().includes(stem));
      if (!hasNearbyTest) {
        items.push({
          location: { path: contract },
          severity: "warn",
          message: "contract has no obvious matching test file",
        });
      }
    }

    if (!hasContractScript) {
      items.push({
        location: { path: "package.json#scripts" },
        severity: "info",
        message: "no obvious contract generation or validation script",
      });
    }

    return { kind: "inventory", items };
  },

  score: {
    kind: "inventory",
    severityWeights: { info: 1, warn: 3, error: 10 },
    bands: [{ upTo: 0, score: 100 }, { upTo: 2, score: 80 }, { upTo: 6, score: 50 }, { score: 0 }],
  },

  fixtures: [
    {
      name: "no-contracts",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "src/index.ts", bytes: 100, lines: 5, depth: 1 }],
        },
        node_package: { present: true, scripts: {} },
      },
      expect: {
        reading: { kind: "na", reason: "no machine-readable contract files detected" },
        score: null,
      },
    },
    {
      name: "contract-tested-and-generated",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 200,
          totalFiles: 2,
          files: [
            { path: "openapi.yaml", bytes: 100, lines: 10, depth: 0 },
            { path: "test/openapi.test.ts", bytes: 100, lines: 5, depth: 1 },
          ],
        },
        node_package: { present: true, scripts: { "openapi:check": "openapi lint openapi.yaml" } },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "contract-without-checks",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "schema.graphql", bytes: 100, lines: 10, depth: 0 }],
        },
        node_package: { present: true, scripts: { test: "vitest run" } },
      },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "schema.graphql" },
              severity: "warn",
              message: "contract has no obvious matching test file",
            },
            {
              location: { path: "package.json#scripts" },
              severity: "info",
              message: "no obvious contract generation or validation script",
            },
          ],
        },
        score: 50,
      },
    },
  ],
});

function contractStem(contract: string): string {
  const name = contract.split("/").pop() ?? contract;
  return name
    .replace(/\.(?:ya?ml|json|proto|graphql|prisma|ts|js)$/i, "")
    .replace(/\.schema$/i, "")
    .toLowerCase();
}
