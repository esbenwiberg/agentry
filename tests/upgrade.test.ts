import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findLockedEntry,
  findLockedProvide,
  readLockfile,
  writeLockfile,
} from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import { makeGitRepoFixture } from "./helpers/fixtures.js";

const CHANGELOG_SKILL = ".claude/skills/changelog/skill.md";

async function installChangelog(cwd: string): Promise<void> {
  const res = await runCli(["add", "changelog", "--non-interactive"], { cwd });
  expect(res.code).toBe(0);
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

describe("agentry upgrade", () => {
  it("refreshes an out-of-date file (dest matches lockfile but not src)", async () => {
    const cwd = await makeGitRepoFixture();
    await installChangelog(cwd);
    const claudeMd = resolve(cwd, CHANGELOG_SKILL);

    const stale = "STALE PRIOR VERSION\n";
    await writeFile(claudeMd, stale);

    const lf = await readLockfile(cwd);
    expect(lf).not.toBeNull();
    const entry = findLockedEntry(lf, "changelog");
    const provide = findLockedProvide(entry, CHANGELOG_SKILL);
    expect(provide).toBeDefined();
    provide!.checksum = sha256(stale);
    await writeLockfile(cwd, lf!);

    const res = await runCli(
      ["upgrade", "changelog", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(claudeMd, "utf8")).not.toBe(stale);
  });

  it("preserves user edits without --force", async () => {
    const cwd = await makeGitRepoFixture();
    await installChangelog(cwd);
    const claudeMd = resolve(cwd, CHANGELOG_SKILL);
    const userText = "USER EDIT — not from catalog";
    await writeFile(claudeMd, userText);

    const res = await runCli(
      ["upgrade", "changelog", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(claudeMd, "utf8")).toBe(userText);
  });

  it("--force overwrites user edits", async () => {
    const cwd = await makeGitRepoFixture();
    await installChangelog(cwd);
    const claudeMd = resolve(cwd, CHANGELOG_SKILL);
    await writeFile(claudeMd, "USER EDIT");

    const res = await runCli(
      ["upgrade", "changelog", "--non-interactive", "--force"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(claudeMd, "utf8")).not.toBe("USER EDIT");
  });
});
