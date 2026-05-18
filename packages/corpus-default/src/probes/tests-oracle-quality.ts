import { defineProbe } from "@esbenwiberg/repofit/sdk";

const PROBE_VERSION = "1.0.0";
const MAX_TEST_FILES = 6;
const MAX_CHARS_PER_TEST = 2_500;
const MAX_INPUT_CHARS = 18_000;

const TEST_FILE = /(?:\.test\.|\.spec\.|__tests__|^tests?\/|^e2e\/)/i;
const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|cs|go|rs|java|kt)$/i;
const SKIP_DIRS = /(?:^|\/)(?:node_modules|dist|build|coverage|\.next|\.nuxt|out|target|bin|obj)\//;

const RUBRIC = {
  task: "Judge whether this repository's tests act as useful oracles for a coding agent, rather than merely pleasing reviewers with superficial coverage.",
  criteria: [
    {
      id: "behavioral-assertions",
      description:
        "Do tests assert externally meaningful behavior, outputs, state changes, errors, or contracts? Tests with no assertions, trivial truthiness, or assertions that only mirror implementation details score low.",
    },
    {
      id: "negative-and-edge-cases",
      description:
        "Do tests include failure paths, edge cases, invalid inputs, permissions, empty states, or regression scenarios? Happy-path-only tests score lower.",
    },
    {
      id: "mock-discipline",
      description:
        "Are mocks/stubs used to isolate boundaries while preserving the behavior under test? Tests that mock the unit itself, assert only that mocks were called, or overfit to implementation score low.",
    },
    {
      id: "review-resistance",
      description:
        "Would these tests reject a plausible but wrong agent patch, or could an agent satisfy them with a shallow implementation? Tests that encode real facts and invariants score high.",
    },
  ],
} as const;

export default defineProbe({
  id: "tests.oracle-quality",
  version: PROBE_VERSION,
  dimensions: [{ id: "feedback", weight: 1 }],
  tier: "reasoned",
  evidence: ["files", "size_stats", "judge"],

  rationale: `
    A passing test suite is only useful when the tests can reject wrong
    behavior. Agents often add "pleasing" tests: smoke checks, snapshots,
    mock-call assertions, or tests that merely document the implementation
    they just wrote. This probe samples test files and asks whether they are
    real behavioral oracles.
  `,

  remediation:
    "Strengthen tests around behavior and contracts: assert outputs and state, cover edge/failure cases, keep mocks at boundaries, and add regression tests that would fail for the bug or requirement being addressed. Avoid assertion-free smoke tests, pure snapshot tests, and tests that only assert mock calls.",

  async detect(ev) {
    const testPaths = ev.size_stats.files
      .map((f) => f.path)
      .filter((p) => SOURCE_FILE.test(p) && TEST_FILE.test(p) && !SKIP_DIRS.test(`/${p}`))
      .sort();

    if (testPaths.length === 0) {
      return { kind: "na", reason: "no test files detected" };
    }

    const sampled: { path: string; text: string }[] = [];
    let totalChars = 0;
    for (const p of testPaths) {
      if (sampled.length >= MAX_TEST_FILES) break;
      const text = await ev.files.readText(p);
      if (!text) continue;
      const slice = text.slice(0, MAX_CHARS_PER_TEST);
      sampled.push({ path: p, text: slice });
      totalChars += slice.length;
      if (totalChars >= MAX_INPUT_CHARS) break;
    }

    if (sampled.length === 0) {
      return { kind: "na", reason: "test files declared but unreadable" };
    }

    const input = sampled.map((s) => `# ${s.path}\n\n${s.text}`).join("\n\n---\n\n");
    const result = await ev.judge.score({
      probeId: "tests.oracle-quality",
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
      name: "no-tests",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "src/index.ts", bytes: 100, lines: 8, depth: 1 }],
        },
      },
      expect: { reading: { kind: "na", reason: "no test files detected" }, score: null },
    },
    {
      name: "strong-oracles",
      evidence: {
        files: {
          "src/parse.test.ts":
            'import { parsePort } from "./parse";\n\ntest("rejects out of range ports", () => {\n  expect(() => parsePort("70000")).toThrow(/port/i);\n});\n\ntest("accepts valid port", () => {\n  expect(parsePort("5432")).toBe(5432);\n});\n',
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 240,
          totalFiles: 1,
          files: [{ path: "src/parse.test.ts", bytes: 240, lines: 9, depth: 1 }],
        },
        judge: {
          score: 80,
          perCriterion: {
            "behavioral-assertions": 80,
            "negative-and-edge-cases": 80,
            "mock-discipline": 80,
            "review-resistance": 80,
          },
          rationale: "Tests assert behavior and failure cases without over-mocking.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 80,
          perCriterion: {
            "behavioral-assertions": 80,
            "negative-and-edge-cases": 80,
            "mock-discipline": 80,
            "review-resistance": 80,
          },
          rationale: "Tests assert behavior and failure cases without over-mocking.",
          model: "fixture",
        },
        score: 80,
      },
    },
  ],
});
