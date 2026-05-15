import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GatherContext, PyProjectInfo, PythonProjectEvidence } from "../../sdk/types.js";
import { listTrackedFiles } from "../../util/git.js";

const PYPROJECT_LIMIT = 50;

const PYPROJECT_RE = /(?:^|\/)pyproject\.toml$/i;
const REQUIREMENTS_RE = /(?:^|\/)requirements(?:[-.][\w.-]+)?\.txt$/i;
const POETRY_LOCK_RE = /(?:^|\/)poetry\.lock$/i;
const UV_LOCK_RE = /(?:^|\/)uv\.lock$/i;
const PIPFILE_LOCK_RE = /(?:^|\/)Pipfile\.lock$/i;
const SETUP_CFG_RE = /(?:^|\/)setup\.cfg$/i;
const SETUP_PY_RE = /(?:^|\/)setup\.py$/i;

const BUILD_SYSTEM_RE = /^\s*\[build-system\]/m;
const TOOL_SECTION_RE = /^\s*\[tool\.([A-Za-z0-9_.-]+)\]/gm;
const PROJECT_NAME_RE = /^\s*\[project\][\s\S]*?^\s*name\s*=\s*["']([^"']+)["']/m;

const EMPTY: PythonProjectEvidence = {
  present: false,
  pyproject: null,
  requirementsFiles: [],
  hasPoetryLock: false,
  hasUvLock: false,
  hasPipfileLock: false,
  hasSetupCfg: false,
  hasSetupPy: false,
};

export const pythonProjectSubsystem = {
  async gather(ctx: GatherContext): Promise<PythonProjectEvidence> {
    const paths = await listTrackedFiles(ctx.cwd);
    if (paths === null) return EMPTY;

    const pyprojectPaths = paths.filter((p) => PYPROJECT_RE.test(p)).slice(0, PYPROJECT_LIMIT);
    const requirementsFiles = paths.filter((p) => REQUIREMENTS_RE.test(p));
    const hasPoetryLock = paths.some((p) => POETRY_LOCK_RE.test(p));
    const hasUvLock = paths.some((p) => UV_LOCK_RE.test(p));
    const hasPipfileLock = paths.some((p) => PIPFILE_LOCK_RE.test(p));
    const hasSetupCfg = paths.some((p) => SETUP_CFG_RE.test(p));
    const hasSetupPy = paths.some((p) => SETUP_PY_RE.test(p));

    let pyproject: PyProjectInfo | null = null;
    const rootPyproject = pyprojectPaths.find((p) => !p.includes("/")) ?? pyprojectPaths[0];
    if (rootPyproject) pyproject = await readPyproject(ctx.cwd, rootPyproject);

    const present =
      pyproject !== null ||
      requirementsFiles.length > 0 ||
      hasPoetryLock ||
      hasUvLock ||
      hasPipfileLock ||
      hasSetupCfg ||
      hasSetupPy;

    return {
      present,
      pyproject,
      requirementsFiles,
      hasPoetryLock,
      hasUvLock,
      hasPipfileLock,
      hasSetupCfg,
      hasSetupPy,
    };
  },
};

async function readPyproject(cwd: string, path: string): Promise<PyProjectInfo | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, path), "utf8");
  } catch {
    return null;
  }

  const tools = new Set<string>();
  for (const m of raw.matchAll(TOOL_SECTION_RE)) {
    const name = m[1]?.split(".")[0];
    if (name) tools.add(name);
  }

  const info: PyProjectInfo = {
    path,
    hasBuildSystem: BUILD_SYSTEM_RE.test(raw),
    tools: [...tools].sort(),
  };
  const nameMatch = PROJECT_NAME_RE.exec(raw);
  if (nameMatch?.[1]) info.projectName = nameMatch[1];
  return info;
}
