import { posix as path } from "node:path";
import type { InventoryItem } from "@esbenwiberg/repofit/sdk";
import { defineProbe } from "@esbenwiberg/repofit/sdk";

const SOURCE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_FILE = /(?:\.test\.|\.spec\.|__tests__|^tests?\/|^e2e\/)/i;
const SKIP_DIRS = /(?:^|\/)(?:node_modules|dist|build|coverage|\.next|\.nuxt|out|target|bin|obj)\//;
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const FAN_OUT_WARN = 12;
const FAN_IN_WARN = 20;
const MAX_ITEMS = 30;

const IMPORT_RE =
  /\bimport\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]|\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

export default defineProbe({
  id: "arch.coupling-hotspots",
  version: "1.0.0",
  dimensions: [
    { id: "context", weight: 0.5 },
    { id: "cost", weight: 1 },
    { id: "consistency", weight: 0.5 },
  ],
  tier: "static",
  evidence: ["files", "size_stats"],

  rationale: `
    Agents pay for coupling twice: they need more context before changing a
    hotspot, and each edit has a wider blast radius. This probe builds a
    lightweight graph from relative JS/TS imports and flags import cycles,
    high fan-out files, and high fan-in files.
  `,

  remediation:
    "Break import cycles, split files that import too many local modules, and stabilize high fan-in modules with clearer contracts and tests. Hotspots are not always wrong, but they deserve names, docs, and extra care.",

  async detect(ev) {
    const sourcePaths = ev.size_stats.files
      .filter((f) => !f.generated)
      .map((f) => f.path)
      .filter((p) => SOURCE_FILE.test(p) && !TEST_FILE.test(p) && !SKIP_DIRS.test(`/${p}`))
      .sort();

    if (sourcePaths.length === 0) {
      return { kind: "na", reason: "no JS/TS source files detected" };
    }

    const sourceSet = new Set(sourcePaths);
    const graph = new Map<string, Set<string>>();
    for (const p of sourcePaths) graph.set(p, new Set());

    for (const p of sourcePaths) {
      const text = await ev.files.readText(p);
      if (!text) continue;
      for (const spec of extractImports(text)) {
        const resolved = resolveRelativeImport(p, spec, sourceSet);
        if (resolved) graph.get(p)?.add(resolved);
      }
    }

    const items: InventoryItem[] = [];
    const cycles = findCycles(graph);
    for (const cycle of cycles.slice(0, 10)) {
      items.push({
        location: { path: cycle[0] ?? "" },
        severity: "error",
        message: `import cycle: ${cycle.join(" -> ")}`,
      });
    }

    const fanIn = new Map<string, number>();
    for (const p of sourcePaths) fanIn.set(p, 0);
    for (const deps of graph.values()) {
      for (const dep of deps) fanIn.set(dep, (fanIn.get(dep) ?? 0) + 1);
    }

    for (const [p, deps] of graph) {
      if (deps.size > FAN_OUT_WARN) {
        items.push({
          location: { path: p },
          severity: "warn",
          message: `high fan-out: imports ${deps.size} local modules`,
        });
      }
    }
    for (const [p, count] of fanIn) {
      if (count > FAN_IN_WARN) {
        items.push({
          location: { path: p },
          severity: "warn",
          message: `high fan-in: imported by ${count} local modules`,
        });
      }
    }

    return { kind: "inventory", items: items.slice(0, MAX_ITEMS) };
  },

  score: {
    kind: "inventory",
    severityWeights: { info: 1, warn: 3, error: 10 },
    bands: [
      { upTo: 0, score: 100 },
      { upTo: 3, score: 80 },
      { upTo: 6, score: 50 },
      { upTo: 9, score: 20 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "no-js-ts-source",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "README.md", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "na", reason: "no JS/TS source files detected" }, score: null },
    },
    {
      name: "simple-acyclic",
      evidence: {
        files: {
          "src/a.ts": 'import { b } from "./b";\nexport const a = b;\n',
          "src/b.ts": "export const b = 1;\n",
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 120,
          totalFiles: 2,
          files: [
            { path: "src/a.ts", bytes: 80, lines: 2, depth: 1 },
            { path: "src/b.ts", bytes: 40, lines: 1, depth: 1 },
          ],
        },
      },
      expect: { reading: { kind: "inventory", items: [] }, score: 100 },
    },
    {
      name: "cycle",
      evidence: {
        files: {
          "src/a.ts": 'import { b } from "./b";\nexport const a = b;\n',
          "src/b.ts": 'import { a } from "./a";\nexport const b = a;\n',
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 160,
          totalFiles: 2,
          files: [
            { path: "src/a.ts", bytes: 80, lines: 2, depth: 1 },
            { path: "src/b.ts", bytes: 80, lines: 2, depth: 1 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "inventory",
          items: [
            {
              location: { path: "src/a.ts" },
              severity: "error",
              message: "import cycle: src/a.ts -> src/b.ts -> src/a.ts",
            },
          ],
        },
        score: 0,
      },
    },
  ],
});

function extractImports(text: string): string[] {
  const out: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let match = IMPORT_RE.exec(text);
  while (match !== null) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec?.startsWith(".")) out.push(spec);
    match = IMPORT_RE.exec(text);
  }
  return out;
}

function resolveRelativeImport(
  fromPath: string,
  spec: string,
  sourceSet: Set<string>,
): string | null {
  const base = path.normalize(path.join(path.dirname(fromPath), spec));
  const candidates = [base, ...EXTENSIONS.map((ext) => `${base}${ext}`)];
  for (const ext of EXTENSIONS) candidates.push(path.join(base, `index${ext}`));
  return candidates.find((candidate) => sourceSet.has(candidate)) ?? null;
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(node: string) {
    if (cycles.length >= 10) return;
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (visiting.has(next)) {
        const idx = stack.indexOf(next);
        const cycle = [...stack.slice(idx), next];
        const key = canonicalCycleKey(cycle);
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (!visited.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) visit(node);
  }
  return cycles;
}

function canonicalCycleKey(cycle: string[]): string {
  const body = cycle.slice(0, -1);
  const rotations = body.map((_, i) => [...body.slice(i), ...body.slice(0, i)].join(" -> "));
  return rotations.sort()[0] ?? cycle.join(" -> ");
}
