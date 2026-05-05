import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  "target",
  "vendor",
  ".gradle",
  ".idea",
  ".vscode",
  "coverage",
  ".nyc_output",
  ".turbo",
  ".parcel-cache",
  ".agentry",
]);

const ALLOWED_DOT_ENTRIES = new Set([
  ".github",
  ".gitlab",
  ".circleci",
  ".changes",
  ".changeset",
  ".husky",
  ".githooks",
  ".claude",
  ".cursor",
  ".codex",
  ".aider",
  ".continue",
  ".windsurf",
  ".chatmode",
  ".gitignore",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".env.example",
  ".nvmrc",
  ".tool-versions",
  ".python-version",
  ".ruff.toml",
  ".pre-commit-config.yaml",
]);

const LANG_BY_EXT: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".fs": "F#",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".c": "C",
  ".h": "C/C++ header",
  ".hpp": "C++ header",
  ".swift": "Swift",
  ".scala": "Scala",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".sql": "SQL",
  ".md": "Markdown",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".json": "JSON",
  ".toml": "TOML",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".lua": "Lua",
  ".dart": "Dart",
};

const MANIFEST_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "pnpm-workspace.yaml",
  "lerna.json",
  "nx.json",
  "turbo.json",
  "rush.json",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
  "requirements.txt",
  "Pipfile",
  "Pipfile.lock",
  "poetry.lock",
  "uv.lock",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "Makefile",
  "justfile",
  "Taskfile.yml",
  "Taskfile.yaml",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
]);

const MANIFEST_EXT_RE = /\.(csproj|sln|fsproj|vbproj)$/i;

const MAX_DEPTH = 4;
const MAX_TREE_LINES = 800;
const MAX_FILE_SIZE_FOR_LOC = 1_000_000;

interface LangStats {
  byLanguage: Record<string, { files: number; loc: number }>;
  totals: { files: number; loc: number };
}

interface ManifestSummary {
  path: string;
  size: number;
}

function isManifestFile(name: string): boolean {
  if (MANIFEST_FILES.has(name)) return true;
  return MANIFEST_EXT_RE.test(name);
}

function shouldVisit(name: string, isDir: boolean): boolean {
  if (name.startsWith(".")) {
    if (isDir) return ALLOWED_DOT_ENTRIES.has(name) && !IGNORE_DIRS.has(name);
    return ALLOWED_DOT_ENTRIES.has(name) || /\.example$/i.test(name);
  }
  if (isDir && IGNORE_DIRS.has(name)) return false;
  return true;
}

async function walk(
  root: string,
  rel: string,
  depth: number,
  treeLines: string[],
  langs: LangStats,
  manifests: ManifestSummary[],
): Promise<void> {
  if (depth > MAX_DEPTH) return;
  if (treeLines.length >= MAX_TREE_LINES) return;

  let entries;
  try {
    entries = await readdir(resolve(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const ent of entries) {
    if (!shouldVisit(ent.name, ent.isDirectory())) continue;
    const fullRel = rel === "" ? ent.name : `${rel}/${ent.name}`;
    const indent = "  ".repeat(depth);

    if (ent.isDirectory()) {
      treeLines.push(`${indent}${ent.name}/`);
      if (treeLines.length >= MAX_TREE_LINES) {
        treeLines.push(`${indent}  ... (truncated, max ${MAX_TREE_LINES} lines)`);
        return;
      }
      await walk(root, fullRel, depth + 1, treeLines, langs, manifests);
    } else if (ent.isFile()) {
      let size = 0;
      try {
        const s = await stat(resolve(root, fullRel));
        size = s.size;
      } catch {
        continue;
      }
      treeLines.push(`${indent}${ent.name} (${size}b)`);

      const ext = extname(ent.name).toLowerCase();
      const langName = LANG_BY_EXT[ext];
      if (langName) {
        if (!langs.byLanguage[langName]) {
          langs.byLanguage[langName] = { files: 0, loc: 0 };
        }
        langs.byLanguage[langName].files += 1;
        langs.totals.files += 1;
        if (size > 0 && size < MAX_FILE_SIZE_FOR_LOC) {
          try {
            const txt = await readFile(resolve(root, fullRel), "utf8");
            const lines = txt.length === 0 ? 0 : txt.split("\n").length;
            langs.byLanguage[langName].loc += lines;
            langs.totals.loc += lines;
          } catch {
            /* unreadable — skip */
          }
        }
      }
      if (isManifestFile(ent.name)) {
        manifests.push({ path: fullRel, size });
      }
    }
  }
}

export const structureGatherer: Gatherer = {
  name: "structure",
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "structure");
    await mkdir(dir, { recursive: true });

    const treeLines: string[] = [];
    const langs: LangStats = { byLanguage: {}, totals: { files: 0, loc: 0 } };
    const manifests: ManifestSummary[] = [];

    await walk(ctx.cwd, "", 0, treeLines, langs, manifests);

    await writeFile(join(dir, "tree.txt"), treeLines.join("\n") + "\n");
    await writeFile(
      join(dir, "languages.json"),
      JSON.stringify(langs, null, 2),
    );
    await writeFile(
      join(dir, "manifests.json"),
      JSON.stringify(manifests, null, 2),
    );

    return ["structure/tree.txt", "structure/languages.json", "structure/manifests.json"];
  },
};
