import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach } from "vitest";

const trackedDirs: string[] = [];

afterEach(async () => {
  while (trackedDirs.length > 0) {
    const dir = trackedDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

export async function makeRepoFixture(
  files?: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agentry-test-"));
  trackedDirs.push(root);
  if (files) {
    for (const [rel, contents] of Object.entries(files)) {
      const full = resolve(root, rel);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contents);
    }
  }
  return root;
}

export async function makeGitRepoFixture(
  files?: Record<string, string>,
): Promise<string> {
  const root = await makeRepoFixture(files);
  await mkdir(resolve(root, ".git"), { recursive: true });
  return root;
}
