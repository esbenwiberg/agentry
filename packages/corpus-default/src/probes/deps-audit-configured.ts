import { defineProbe } from "@esbenwiberg/repofit/sdk";

const NODE_AUDIT_HINTS = [
  /\bnpm\s+audit\b/,
  /\bpnpm\s+audit\b/,
  /\byarn\s+audit\b/,
  /\baudit-ci\b/,
  /\bbetter-npm-audit\b/,
  /\bsnyk\s+test\b/i,
  /\bsnyk\b/i,
];

const PY_AUDIT_HINTS = [/\bpip-audit\b/i, /\bsafety\s+(?:check|scan)\b/i];
const GO_AUDIT_HINTS = [/\bgovulncheck\b/i];
const RUST_AUDIT_HINTS = [/\bcargo[-\s]audit\b/i, /\bcargo[-\s]deny\b/i];
const JAVA_AUDIT_HINTS = [/\bdependency-check\b/i, /\borg\.owasp:dependency-check\b/i, /\bsnyk\b/i];
const DOTNET_AUDIT_HINTS = [/\bdotnet\s+list\s+package\s+--vulnerable\b/i, /\bdotnet-retire\b/i];
const RUBY_AUDIT_HINTS = [/\bbundle(?:r)?[-\s]audit\b/i];
const GENERIC_AUDIT_HINTS = [
  /\btrivy\s+(?:fs|repo)\b/i,
  /\bdependabot\b/i,
  /uses:\s*github\/dependency-review-action/i,
];

const ALL_HINTS = [
  ...NODE_AUDIT_HINTS,
  ...PY_AUDIT_HINTS,
  ...GO_AUDIT_HINTS,
  ...RUST_AUDIT_HINTS,
  ...JAVA_AUDIT_HINTS,
  ...DOTNET_AUDIT_HINTS,
  ...RUBY_AUDIT_HINTS,
  ...GENERIC_AUDIT_HINTS,
];

const DEPENDABOT_PATHS = [".github/dependabot.yml", ".github/dependabot.yaml"];

export default defineProbe({
  id: "deps.audit-configured",
  version: "1.0.0",
  dimensions: [{ id: "safety", weight: 1 }],
  tier: "static",
  evidence: ["node_package", "files", "ci_workflows"],

  rationale: `
    A vulnerability scanner is the only durable defence against a
    transitive dependency landing a known CVE in your tree. Without one,
    an agent (or human) won't notice until production. This probe looks
    for a recognised audit step in package.json scripts or in a CI
    workflow, across the major ecosystems (npm/yarn/pnpm audit,
    pip-audit/safety, govulncheck, cargo audit / cargo deny, OWASP
    dependency-check, \`dotnet list package --vulnerable\`,
    bundler-audit), plus generic options (Snyk, Trivy, Dependabot).
  `,

  remediation:
    "Wire a vuln audit into CI. Node: `npx audit-ci --moderate` or `npm audit --audit-level=high`. Python: `pip-audit`. Go: `govulncheck ./...`. Rust: `cargo audit`. Java: OWASP `dependency-check`. .NET: `dotnet list package --vulnerable --include-transitive`. Ruby: `bundle audit`. Alternative: enable GitHub Dependabot (commit `.github/dependabot.yml`) or use Snyk/Trivy. Pick one — any audit is better than no audit.",

  async detect(ev) {
    const checkText = (raw: string | undefined) =>
      raw ? ALL_HINTS.some((p) => p.test(raw)) : false;

    if (ev.node_package.present) {
      const scriptsBlob = Object.values(ev.node_package.scripts).join("\n");
      if (checkText(scriptsBlob)) return { kind: "predicate", value: true };
      if (
        "audit-ci" in ev.node_package.devDependencies ||
        "better-npm-audit" in ev.node_package.devDependencies ||
        "snyk" in ev.node_package.devDependencies
      ) {
        return { kind: "predicate", value: true };
      }
    }

    for (const wf of ev.ci_workflows.workflows) {
      if (ALL_HINTS.some((p) => p.test(wf.raw))) {
        return { kind: "predicate", value: true };
      }
    }

    for (const path of DEPENDABOT_PATHS) {
      if (ev.files.has(path)) return { kind: "predicate", value: true };
    }

    return { kind: "predicate", value: false };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "nothing-configured",
      evidence: {
        node_package: { present: true },
        files: [],
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "npm-audit-in-script",
      evidence: {
        node_package: {
          present: true,
          scripts: { audit: "npm audit --audit-level=high" },
        },
        files: [],
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "audit-ci-devdep",
      evidence: {
        node_package: {
          present: true,
          devDependencies: { "audit-ci": "^7.0.0" },
        },
        files: [],
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "govulncheck-in-ci",
      evidence: {
        node_package: { present: false },
        files: [],
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/sec.yml", raw: "run: govulncheck ./..." }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "cargo-audit-in-ci",
      evidence: {
        node_package: { present: false },
        files: [],
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/audit.yml", raw: "run: cargo audit" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "dotnet-vulnerable-in-ci",
      evidence: {
        node_package: { present: false },
        files: [],
        ci_workflows: {
          present: true,
          workflows: [
            {
              path: ".github/workflows/ci.yml",
              raw: "run: dotnet list package --vulnerable --include-transitive",
            },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "dependabot-config",
      evidence: {
        node_package: { present: false },
        files: [".github/dependabot.yml"],
        ci_workflows: { present: false, workflows: [] },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "pip-audit-in-ci",
      evidence: {
        node_package: { present: false },
        files: [],
        ci_workflows: {
          present: true,
          workflows: [{ path: ".github/workflows/sec.yml", raw: "run: pip-audit" }],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
  ],
});
