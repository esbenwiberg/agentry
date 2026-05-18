import { defineProbe } from "@esbenwiberg/repofit/sdk";

const PROBE_VERSION = "1.0.0";
const MAX_SPECS = 5;
const MAX_TEST_FILES = 40;
const MAX_CHARS_PER_SPEC = 2_500;
const MAX_INPUT_CHARS = 18_000;

const SPEC_DIRS = [
  "specs",
  "spec",
  ".specify",
  "docs/specs",
  "docs/features",
  "features",
  ".features",
  "rfcs",
  "docs/rfcs",
];

const SPEC_FILE = /\.(?:md|markdown)$/i;
const TEST_FILE = /(?:\.test\.|\.spec\.|__tests__|^tests?\/|^e2e\/)/i;
const TEST_SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|cs|go|rs|java|kt)$/i;
const TEST_NAME_LINE =
  /\b(?:test|it|describe|scenario|context)\s*\(\s*["'`]([^"'`]{4,120})["'`]/i;
const PY_TEST_NAME = /^\s*def\s+(test_[a-zA-Z0-9_]+)/;
const GO_TEST_NAME = /^\s*func\s+(Test[A-Za-z0-9_]+)\s*\(/;

const RUBRIC = {
  task: "Judge whether acceptance criteria and scenario facts in the repo's specs are traceable to executable tests.",
  criteria: [
    {
      id: "criteria-extracted",
      description:
        "Do the specs contain concrete acceptance criteria, test cases, examples, or Given/When/Then scenarios that can become tests? Vague prose without checkable facts scores low.",
    },
    {
      id: "tests-map-to-criteria",
      description:
        "Do test names or test files clearly correspond to those criteria or scenarios? Strong traceability means a reviewer can point from a spec bullet to a test.",
    },
    {
      id: "behavior-not-implementation",
      description:
        "Are the traced tests framed around user-visible behavior, API contracts, or business rules rather than implementation details?",
    },
    {
      id: "coverage-of-negative-cases",
      description:
        "Are important failure, edge, permission, or invalid-input criteria represented in tests, not only happy paths?",
    },
  ],
} as const;

function extractInterestingTestLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (TEST_NAME_LINE.test(trimmed) || PY_TEST_NAME.test(trimmed) || GO_TEST_NAME.test(trimmed)) {
      out.push(trimmed);
    }
  }
  return out;
}

export default defineProbe({
  id: "specs.test-traceability",
  version: PROBE_VERSION,
  dimensions: [
    { id: "context", weight: 0.7 },
    { id: "feedback", weight: 1 },
  ],
  tier: "reasoned",
  evidence: ["files", "size_stats", "judge"],

  rationale: `
    Acceptance criteria only become reliable agent feedback when they are
    connected to tests. This probe samples feature specs plus test names and
    asks whether G/W/T, acceptance criteria, and test-case facts are traceable
    to executable checks.
  `,

  remediation:
    "For every acceptance criterion or Given/When/Then scenario, add or name a matching test. Keep the wording close enough that reviewers and agents can trace spec facts to executable checks, including negative and edge cases.",

  async detect(ev) {
    const specPaths = ev.size_stats.files
      .map((f) => f.path)
      .filter((p) => SPEC_FILE.test(p) && SPEC_DIRS.some((dir) => p.startsWith(`${dir}/`)))
      .sort();

    if (specPaths.length === 0) {
      return { kind: "na", reason: "no feature specs found" };
    }

    const testPaths = ev.size_stats.files
      .map((f) => f.path)
      .filter((p) => TEST_SOURCE_FILE.test(p) && TEST_FILE.test(p))
      .sort();

    if (testPaths.length === 0) {
      return { kind: "na", reason: "no test files detected" };
    }

    const specs: { path: string; text: string }[] = [];
    let chars = 0;
    for (const p of specPaths) {
      if (specs.length >= MAX_SPECS) break;
      const text = await ev.files.readText(p);
      if (!text) continue;
      const slice = text.slice(0, MAX_CHARS_PER_SPEC);
      specs.push({ path: p, text: slice });
      chars += slice.length;
      if (chars >= MAX_INPUT_CHARS) break;
    }

    const tests: string[] = [];
    for (const p of testPaths.slice(0, MAX_TEST_FILES)) {
      const text = await ev.files.readText(p);
      const names = text ? extractInterestingTestLines(text) : [];
      tests.push(`${p}${names.length ? `\n${names.map((n) => `  ${n}`).join("\n")}` : ""}`);
    }

    if (specs.length === 0) {
      return { kind: "na", reason: "spec files declared but unreadable" };
    }

    const input = [
      "# Specs",
      specs.map((s) => `## ${s.path}\n${s.text}`).join("\n\n---\n\n"),
      "",
      "# Test files and test names",
      tests.join("\n\n"),
    ]
      .join("\n")
      .slice(0, MAX_INPUT_CHARS);

    const result = await ev.judge.score({
      probeId: "specs.test-traceability",
      probeVersion: PROBE_VERSION,
      input,
      rubric: RUBRIC,
    });

    return {
      kind: "judge",
      score: result.score,
      perCriterion: result.perCriterion,
      rationale: result.rationale,
      model: result.model,
    };
  },

  score: { kind: "judge" },

  fixtures: [
    {
      name: "no-specs",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "src/login.test.ts", bytes: 100, lines: 3, depth: 1 }],
        },
      },
      expect: { reading: { kind: "na", reason: "no feature specs found" }, score: null },
    },
    {
      name: "criteria-traced-to-tests",
      evidence: {
        files: {
          "specs/login.md":
            "# Login\n\n## Acceptance\n- Given valid credentials, when the user signs in, then the app creates a session.\n- Given invalid credentials, then the app returns an error.\n",
          "src/login.test.ts":
            'test("valid credentials create a session", () => {});\ntest("invalid credentials return an error", () => {});\n',
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 300,
          totalFiles: 2,
          files: [
            { path: "specs/login.md", bytes: 180, lines: 5, depth: 1 },
            { path: "src/login.test.ts", bytes: 120, lines: 2, depth: 1 },
          ],
        },
        judge: {
          score: 80,
          perCriterion: {
            "criteria-extracted": 80,
            "tests-map-to-criteria": 80,
            "behavior-not-implementation": 80,
            "coverage-of-negative-cases": 80,
          },
          rationale: "Concrete criteria are named in matching behavior tests.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 80,
          perCriterion: {
            "criteria-extracted": 80,
            "tests-map-to-criteria": 80,
            "behavior-not-implementation": 80,
            "coverage-of-negative-cases": 80,
          },
          rationale: "Concrete criteria are named in matching behavior tests.",
          model: "fixture",
        },
        score: 80,
      },
    },
  ],
});
