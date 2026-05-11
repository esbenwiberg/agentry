import { exec } from "./exec.js";

const REMOTE_URL_REGEX = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?(?:\s|$)/i;

export async function gitHeadCommit(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function detectGithubRemote(
  cwd: string,
): Promise<{ owner: string; repo: string } | null> {
  try {
    const { stdout } = await exec("git", ["remote", "get-url", "origin"], { cwd });
    const match = REMOTE_URL_REGEX.exec(stdout.trim());
    if (!match?.[1] || !match[2]) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

export async function detectDefaultBranch(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await exec("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], {
      cwd,
    });
    return stdout.trim().replace(/^origin\//, "") || null;
  } catch {
    return null;
  }
}
