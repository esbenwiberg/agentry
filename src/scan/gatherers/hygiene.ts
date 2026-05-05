import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";

interface ChecklistEntry {
  key: string;
  description: string;
  present: boolean;
  detectedAt: string[];
}

interface CiCoverage {
  hasGitHubActions: boolean;
  workflows: string[];
  hasGitLabCI: boolean;
  hasCircleCI: boolean;
  hasJenkins: boolean;
  hasBuildkite: boolean;
}

interface LinterDetection {
  category: string;
  tools: string[];
}

const CHECKS: Array<{
  key: string;
  description: string;
  paths: string[];
}> = [
  { key: "license", description: "LICENSE file", paths: ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"] },
  { key: "readme", description: "README", paths: ["README.md", "README.rst", "README.txt", "README"] },
  { key: "contributing", description: "CONTRIBUTING guide", paths: ["CONTRIBUTING.md", "CONTRIBUTING"] },
  { key: "code-of-conduct", description: "Code of Conduct", paths: ["CODE_OF_CONDUCT.md", "docs/CODE_OF_CONDUCT.md"] },
  { key: "security", description: "Security policy", paths: ["SECURITY.md", "docs/SECURITY.md"] },
  { key: "changelog", description: "CHANGELOG (file or fragments)", paths: ["CHANGELOG.md", "CHANGELOG", ".changes", ".changeset"] },
  { key: "editorconfig", description: ".editorconfig", paths: [".editorconfig"] },
  { key: "gitignore", description: ".gitignore", paths: [".gitignore"] },
  { key: "issue-templates", description: "GitHub issue templates", paths: [".github/ISSUE_TEMPLATE", ".github/issue_template.md"] },
  { key: "pr-template", description: "GitHub PR template", paths: [".github/pull_request_template.md", ".github/PULL_REQUEST_TEMPLATE.md"] },
  { key: "codeowners", description: "CODEOWNERS", paths: ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"] },
  { key: "pre-commit-config", description: ".pre-commit-config.yaml", paths: [".pre-commit-config.yaml"] },
  { key: "git-hooks-dir", description: ".githooks/", paths: [".githooks"] },
  { key: "husky", description: "husky config", paths: [".husky", "package.json"] },
];

function checkAll(cwd: string): ChecklistEntry[] {
  return CHECKS.map((c) => {
    const detected = c.paths.filter((p) => existsSync(resolve(cwd, p)));
    return {
      key: c.key,
      description: c.description,
      present: detected.length > 0,
      detectedAt: detected,
    };
  });
}

function detectCi(cwd: string): CiCoverage {
  const workflows: string[] = [];
  const ghDir = resolve(cwd, ".github", "workflows");
  if (existsSync(ghDir)) {
    try {
      for (const f of readdirSync(ghDir)) {
        if (/\.(yml|yaml)$/i.test(f)) workflows.push(`.github/workflows/${f}`);
      }
    } catch {
      /* unreadable */
    }
  }
  return {
    hasGitHubActions: workflows.length > 0,
    workflows,
    hasGitLabCI: existsSync(resolve(cwd, ".gitlab-ci.yml")),
    hasCircleCI: existsSync(resolve(cwd, ".circleci", "config.yml")),
    hasJenkins: existsSync(resolve(cwd, "Jenkinsfile")),
    hasBuildkite: existsSync(resolve(cwd, ".buildkite", "pipeline.yml")),
  };
}

async function detectLinters(cwd: string): Promise<LinterDetection[]> {
  const out: LinterDetection[] = [];

  const linterFiles: Array<{ tool: string; paths: string[] }> = [
    { tool: "eslint", paths: [".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml", "eslint.config.js", "eslint.config.mjs", "eslint.config.ts"] },
    { tool: "prettier", paths: [".prettierrc", ".prettierrc.json", ".prettierrc.yml", ".prettierrc.js", "prettier.config.js"] },
    { tool: "biome", paths: ["biome.json", "biome.jsonc"] },
    { tool: "ruff", paths: ["ruff.toml", ".ruff.toml"] },
    { tool: "black", paths: ["pyproject.toml"] },
    { tool: "mypy", paths: ["mypy.ini", ".mypy.ini"] },
    { tool: "pyright", paths: ["pyrightconfig.json"] },
    { tool: "rubocop", paths: [".rubocop.yml"] },
    { tool: "golangci-lint", paths: [".golangci.yml", ".golangci.yaml"] },
  ];
  const linters: string[] = [];
  for (const l of linterFiles) {
    if (l.paths.some((p) => existsSync(resolve(cwd, p)))) linters.push(l.tool);
  }
  if (linters.length > 0) out.push({ category: "linters", tools: linters });

  const typeCheckers: string[] = [];
  if (existsSync(resolve(cwd, "tsconfig.json"))) typeCheckers.push("tsc");
  if (existsSync(resolve(cwd, "mypy.ini"))) typeCheckers.push("mypy");
  if (existsSync(resolve(cwd, "pyrightconfig.json"))) typeCheckers.push("pyright");
  if (typeCheckers.length > 0) out.push({ category: "type-checkers", tools: typeCheckers });

  return out;
}

async function gitignoreAudit(cwd: string): Promise<{
  present: boolean;
  ignoresNodeModules: boolean;
  ignoresEnv: boolean;
  ignoresOsFiles: boolean;
  ignoresAgentry: boolean;
}> {
  const path = resolve(cwd, ".gitignore");
  if (!existsSync(path)) {
    return {
      present: false,
      ignoresNodeModules: false,
      ignoresEnv: false,
      ignoresOsFiles: false,
      ignoresAgentry: false,
    };
  }
  let txt = "";
  try {
    txt = await readFile(path, "utf8");
  } catch {
    /* ignore */
  }
  return {
    present: true,
    ignoresNodeModules: /(^|\n)\s*node_modules\/?\s*(\n|$)/.test(txt),
    ignoresEnv: /(^|\n)\s*\.env(?:$|\s|\n)/.test(txt) || /(^|\n)\s*\.env\.\*/.test(txt),
    ignoresOsFiles: /\.DS_Store/.test(txt),
    ignoresAgentry: /(^|\n)\s*\.agentry/.test(txt),
  };
}

async function readmeStructure(cwd: string): Promise<{
  present: boolean;
  lines: number;
  headings: string[];
} | null> {
  const candidates = ["README.md", "README.rst", "README", "README.txt"];
  for (const name of candidates) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      try {
        const txt = await readFile(path, "utf8");
        const lines = txt.split("\n");
        const headings = lines
          .filter((l) => /^#{1,3}\s+/.test(l))
          .slice(0, 30)
          .map((l) => l.replace(/^#+\s+/, "").trim());
        return { present: true, lines: lines.length, headings };
      } catch {
        return { present: true, lines: 0, headings: [] };
      }
    }
  }
  return null;
}

export const hygieneGatherer: Gatherer = {
  name: "hygiene",
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "hygiene");
    await mkdir(dir, { recursive: true });

    const checklist = checkAll(ctx.cwd);
    const ci = detectCi(ctx.cwd);
    const linters = await detectLinters(ctx.cwd);
    const gitignore = await gitignoreAudit(ctx.cwd);
    const readme = await readmeStructure(ctx.cwd);

    await writeFile(
      join(dir, "checklist.json"),
      JSON.stringify(
        {
          items: checklist,
          summary: {
            present: checklist.filter((c) => c.present).length,
            absent: checklist.filter((c) => !c.present).length,
          },
        },
        null,
        2,
      ),
    );
    await writeFile(join(dir, "ci-coverage.json"), JSON.stringify(ci, null, 2));
    await writeFile(
      join(dir, "linters.json"),
      JSON.stringify(linters, null, 2),
    );
    await writeFile(
      join(dir, "gitignore-audit.json"),
      JSON.stringify(gitignore, null, 2),
    );
    await writeFile(
      join(dir, "readme-structure.json"),
      JSON.stringify(readme ?? { present: false }, null, 2),
    );

    return [
      "hygiene/checklist.json",
      "hygiene/ci-coverage.json",
      "hygiene/linters.json",
      "hygiene/gitignore-audit.json",
      "hygiene/readme-structure.json",
    ];
  },
};
