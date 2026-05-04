import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lockfilePath } from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import { makeGitRepoFixture } from "./helpers/fixtures.js";

describe("agentry add", () => {
  it("installs a leaf entry and writes a lockfile", async () => {
    const cwd = await makeGitRepoFixture();
    const res = await runCli(
      ["add", "changelog", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(lockfilePath(cwd))).toBe(true);
    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).toContain('id = "changelog"');
  });

  it("auto-installs declared dependencies in --non-interactive mode", async () => {
    const cwd = await makeGitRepoFixture();
    const res = await runCli(
      ["add", "commits", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).toContain('id = "commits"');
    expect(lock).toContain('id = "changelog"');
  });

  it("--dry-run writes nothing", async () => {
    const cwd = await makeGitRepoFixture();
    const res = await runCli(
      ["add", "changelog", "--non-interactive", "--dry-run"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(lockfilePath(cwd))).toBe(false);
  });

  it("returns non-zero on unknown id", async () => {
    const cwd = await makeGitRepoFixture();
    const res = await runCli(
      ["add", "definitely-not-an-entry", "--non-interactive"],
      { cwd },
    );
    expect(res.code).not.toBe(0);
  });
});
