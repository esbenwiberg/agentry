import { existsSync, statSync } from "node:fs";
import { mkdir, copyFile, readFile, writeFile, stat, chmod } from "node:fs/promises";
import { dirname, delimiter, join, resolve } from "node:path";

export function isGitRepo(cwd: string): boolean {
  return existsSync(resolve(cwd, ".git"));
}

const TOOL_NAME_RE = /^[a-zA-Z0-9_.-]+$/;

export function isToolAvailable(tool: string): boolean {
  if (!TOOL_NAME_RE.test(tool)) return false;
  const path = process.env.PATH ?? "";
  for (const dir of path.split(delimiter)) {
    if (dir === "") continue;
    const candidate = join(dir, tool);
    if (existsSync(candidate)) return true;
  }
  return false;
}

export function fileExists(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

export function dirExists(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export async function filesIdentical(a: string, b: string): Promise<boolean> {
  if (!fileExists(a) || !fileExists(b)) return false;
  const [ba, bb] = await Promise.all([readFile(a), readFile(b)]);
  return ba.equals(bb);
}

export async function ensureDirAndCopy(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  const srcStat = await stat(src);
  await chmod(dest, srcStat.mode & 0o777);
}

export async function ensureDirAndWrite(
  dest: string,
  contents: string | Buffer,
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, contents);
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}
