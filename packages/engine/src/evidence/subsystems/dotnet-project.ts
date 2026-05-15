import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  CentralPackagesInfo,
  DotnetProjectEvidence,
  DotnetProjectInfo,
  GatherContext,
} from "../../sdk/types.js";
import { listTrackedFiles } from "../../util/git.js";

const PROJECT_LIMIT = 100;

const SOLUTION_RE = /\.sln$/i;
const PROJECT_RE = /\.(csproj|fsproj|vbproj)$/i;
const CENTRAL_PACKAGES_RE = /(?:^|\/)Directory\.Packages\.props$/i;

const SDK_ATTR_RE = /<Project\b[^>]*\bSdk="([^"]+)"/i;
const TFM_RE = /<TargetFramework>([^<]+)<\/TargetFramework>/i;
const TFMS_RE = /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i;
const PACKAGE_REF_RE =
  /<PackageReference\s+(?:[^>]*?\b)?Include="([^"]+)"(?:[^>]*?\bVersion="([^"]+)")?/gi;
const PACKAGE_VERSION_RE =
  /<PackageVersion\s+(?:[^>]*?\b)?Include="([^"]+)"(?:[^>]*?\bVersion="([^"]+)")?/gi;

const EMPTY: DotnetProjectEvidence = {
  present: false,
  solutions: [],
  projects: [],
  centralPackageManagement: null,
};

export const dotnetProjectSubsystem = {
  async gather(ctx: GatherContext): Promise<DotnetProjectEvidence> {
    const paths = await listTrackedFiles(ctx.cwd);
    if (paths === null) return EMPTY;

    const solutions = paths.filter((p) => SOLUTION_RE.test(p));
    const projectPaths = paths.filter((p) => PROJECT_RE.test(p)).slice(0, PROJECT_LIMIT);
    const propsPaths = paths.filter((p) => CENTRAL_PACKAGES_RE.test(p));

    if (solutions.length === 0 && projectPaths.length === 0 && propsPaths.length === 0) {
      return EMPTY;
    }

    const propsByDir = new Map<string, CentralPackagesInfo>();
    for (const p of propsPaths) {
      const info = await readCentralPackages(ctx.cwd, p);
      if (info) propsByDir.set(dirname(p), info);
    }

    const projects: DotnetProjectInfo[] = [];
    for (const p of projectPaths) {
      const cpm = findCentralPackagesFor(p, propsByDir);
      const info = await readProject(ctx.cwd, p, cpm);
      if (info) projects.push(info);
    }

    // Pick the closest-to-root Directory.Packages.props as the "primary" CPM.
    const cpmEntries = [...propsByDir.entries()].sort(
      ([a], [b]) => a.split("/").length - b.split("/").length,
    );
    const primaryCpm = cpmEntries[0]?.[1] ?? null;

    return {
      present: true,
      solutions,
      projects,
      centralPackageManagement: primaryCpm,
    };
  },
};

async function readCentralPackages(cwd: string, path: string): Promise<CentralPackagesInfo | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, path), "utf8");
  } catch {
    return null;
  }
  const packageVersions: Record<string, string> = {};
  for (const m of raw.matchAll(PACKAGE_VERSION_RE)) {
    if (m[1]) packageVersions[m[1]] = m[2] ?? "";
  }
  return { path, packageVersions };
}

async function readProject(
  cwd: string,
  path: string,
  cpm: CentralPackagesInfo | null,
): Promise<DotnetProjectInfo | null> {
  let raw: string;
  try {
    raw = await readFile(join(cwd, path), "utf8");
  } catch {
    return null;
  }

  const kindMatch = /\.(csproj|fsproj|vbproj)$/i.exec(path);
  const kind = (kindMatch?.[1]?.toLowerCase() ?? "csproj") as DotnetProjectInfo["kind"];

  const info: DotnetProjectInfo = {
    path,
    kind,
    targetFrameworks: [],
    packageReferences: {},
  };

  const sdkMatch = SDK_ATTR_RE.exec(raw);
  if (sdkMatch?.[1]) info.sdk = sdkMatch[1];

  const tfm = TFM_RE.exec(raw);
  if (tfm?.[1]) info.targetFrameworks = [tfm[1].trim()];
  const tfms = TFMS_RE.exec(raw);
  if (tfms?.[1]) {
    info.targetFrameworks = tfms[1]
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  for (const m of raw.matchAll(PACKAGE_REF_RE)) {
    if (!m[1]) continue;
    const version = m[2] ?? cpm?.packageVersions[m[1]] ?? "";
    info.packageReferences[m[1]] = version;
  }

  return info;
}

/**
 * Directory.Packages.props applies to every project in or below its directory.
 * Walk up from the project file's directory and pick the nearest match.
 */
function findCentralPackagesFor(
  projectPath: string,
  propsByDir: Map<string, CentralPackagesInfo>,
): CentralPackagesInfo | null {
  let dir = dirname(projectPath);
  while (true) {
    const hit = propsByDir.get(dir);
    if (hit) return hit;
    const parent = dirname(dir);
    if (parent === dir || parent === ".") {
      return propsByDir.get(".") ?? propsByDir.get("") ?? null;
    }
    dir = parent;
  }
}
