import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lockfilePath } from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import { makeGitRepoFixture } from "./helpers/fixtures.js";

describe("agentry remove", () => {
  it("deletes installed files and prunes the lockfile", async () => {
    const cwd = await makeGitRepoFixture();
    const add = await runCli(
      ["add", "changelog", "--non-interactive"],
      { cwd },
    );
    expect(add.code).toBe(0);
    const claudeMd = resolve(cwd, ".claude/skills/changelog/skill.md");
    expect(existsSync(claudeMd)).toBe(true);

    const res = await runCli(
      ["remove", "changelog", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(claudeMd)).toBe(false);

    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).not.toContain('id = "changelog"');
  });
});
