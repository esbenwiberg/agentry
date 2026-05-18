import type { InventoryItem, Severity } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const SOURCE_FILE = /\.(?:ts|tsx|py|cs|java|kt)$/i;
const TSCONFIG = /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/i;
const SKIP_DIRS = /(?:^|\/)(?:node_modules|dist|build|coverage|\.next|\.nuxt|out|target|bin|obj)\//;
const TEST_OR_FIXTURE_PATH =
  /(?:\.test\.|\.spec\.|__tests__|^tests?\/|\/tests?\/|^fixtures\/|\/fixtures\/|^examples\/|\/examples\/)/i;

const SOURCE_PATTERNS: { pattern: RegExp; severity: Severity; message: string }[] = [
  {
    pattern: /@ts-ignore\b/,
    severity: "error",
    message: "suppresses TypeScript errors with @ts-ignore",
  },
  {
    pattern: /@ts-expect-error\b/,
    severity: "warn",
    message: "suppresses TypeScript errors with @ts-expect-error",
  },
  {
    pattern: /\bas\s+any\b|<any>|\b:\s*any\b|\bArray<\s*any\s*>|\bPromise<\s*any\s*>/,
    severity: "warn",
    message: "uses TypeScript any escape hatch",
  },
  { pattern: /#\s*type:\s*ignore\b/, severity: "warn", message: "suppresses Python type errors" },
  {
    pattern: /\bfrom\s+typing\s+import\s+.*\bAny\b|\btyping\.Any\b|\b:\s*Any\b/,
    severity: "info",
    message: "uses Python Any",
  },
  { pattern: /\bdynamic\b/, severity: "warn", message: "uses C# dynamic typing escape hatch" },
  {
    pattern: /(?:List|Map|Set|Class)\s+[A-Za-z_][A-Za-z0-9_]*\s*[=;]/,
    severity: "info",
    message: "uses a raw Java generic type",
  },
];

const CONFIG_PATTERNS: { pattern: RegExp; severity: Severity; message: string }[] = [
  {
    pattern: /"strict"\s*:\s*false/,
    severity: "error",
    message: "disables TypeScript strict mode",
  },
  {
    pattern: /"noImplicitAny"\s*:\s*false/,
    severity: "error",
    message: "allows implicit any in TypeScript",
  },
  {
    pattern: /"strictNullChecks"\s*:\s*false/,
    severity: "warn",
    message: "disables TypeScript strict null checks",
  },
  {
    pattern: /"skipLibCheck"\s*:\s*true/,
    severity: "info",
    message: "skips library declaration checking",
  },
];

export default defineProbe({
  id: "types.escape-hatches",
  version: "1.0.0",
  dimensions: [
    { id: "feedback", weight: 1 },
    { id: "context", weight: 0.3 },
  ],
  tier: "static",
  evidence: ["files", "size_stats"],

  rationale: `
    A typechecker helps agents only where the codebase lets it speak.
    Escape hatches such as any, @ts-ignore, Python type ignores, C# dynamic,
    raw Java generics, or loose TypeScript config erase facts the agent could
    otherwise rely on.
  `,

  remediation:
    "Replace broad escape hatches with narrower types, runtime validation, or small documented suppressions. Prefer `unknown` plus refinement over `any`, keep `strict` and `noImplicitAny` enabled, and require comments for unavoidable ignores.",

  async detect(ev) {
    const candidates = ev.size_stats.files
      .filter((f) => !f.generated)
      .map((f) => f.path)
      .filter(
        (p) =>
          (SOURCE_FILE.test(p) || TSCONFIG.test(p)) &&
          !SKIP_DIRS.test(`/${p}`) &&
          !TEST_OR_FIXTURE_PATH.test(p),
      )
      .sort();

    if (candidates.length === 0) {
      return { kind: "na", reason: "no typed-language source or TypeScript config detected" };
    }

    const items: InventoryItem[] = [];
    for (const path of candidates) {
      const text = await ev.files.readText(path);
      if (!text) continue;
      const isConfig = TSCONFIG.test(path);
      const patterns = isConfig ? CONFIG_PATTERNS : SOURCE_PATTERNS;
      const lines = (isConfig ? text : stripStringBodies(text)).split(/\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = isConfig ? (lines[i] ?? "") : lineForMatching(lines[i] ?? "");
        for (const { pattern, severity, message } of patterns) {
          if (pattern.test(line)) {
            items.push({
              location: { path, range: { startLine: i + 1 } },
              severity,
              message,
            });
          }
        }
      }
    }

    return { kind: "inventory", items };
  },

  score: {
    kind: "inventory",
    severityWeights: { info: 1, warn: 3, error: 10 },
    bands: [{ upTo: 0, score: 100 }, { upTo: 3, score: 80 }, { upTo: 9, score: 50 }, { score: 0 }],
  },

  fixtures: [
    {
      name: "no-typed-source",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "README.md", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: {
        reading: { kind: "na", reason: "no typed-language source or TypeScript config detected" },
        score: null,
      },
    },
    {
      name: "clean-types",
      evidence: {
        files: {
          "src/index.ts":
            "export function parse(value: unknown): string { return String(value); }\n",
          "tsconfig.json": '{ "compilerOptions": { "strict": true } }\n',
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 180,
          totalFiles: 2,
          files: [
            { path: "src/index.ts", bytes: 100, lines: 1, depth: 1 },
            { path: "tsconfig.json", bytes: 80, lines: 1, depth: 0 },
          ],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "typescript-escape-hatches",
      evidence: {
        files: {
          "src/index.ts":
            "const value: any = load();\n// @ts-ignore\nexport const x = value.nope;\n",
          "tsconfig.json": '{ "compilerOptions": { "strict": false } }\n',
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 180,
          totalFiles: 2,
          files: [
            { path: "src/index.ts", bytes: 100, lines: 3, depth: 1 },
            { path: "tsconfig.json", bytes: 80, lines: 1, depth: 0 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "src/index.ts", range: { startLine: 1 } },
              severity: "warn",
              message: "uses TypeScript any escape hatch",
            },
            {
              location: { path: "src/index.ts", range: { startLine: 2 } },
              severity: "error",
              message: "suppresses TypeScript errors with @ts-ignore",
            },
            {
              location: { path: "tsconfig.json", range: { startLine: 1 } },
              severity: "error",
              message: "disables TypeScript strict mode",
            },
          ],
        },
        score: 0,
      },
    },
  ],
});

function lineForMatching(line: string): string {
  if (/^\s*(pattern|message|rationale|remediation):/.test(line)) return "";
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "");
}

function stripStringBodies(text: string): string {
  let out = "";
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;

  for (const ch of text) {
    if (quote) {
      if (ch === "\n") {
        out += "\n";
        if (quote !== "`") quote = null;
        escaped = false;
        continue;
      }
      out += " ";
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      out += " ";
      continue;
    }
    out += ch;
  }

  return out;
}
