import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { gitignoreSubsystem } from "../src/evidence/subsystems/gitignore.js";

describe("gitignore subsystem", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("missing .gitignore → not present, ignores nothing", async () => {
    const ev = await gitignoreSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
    expect(ev.patterns).toEqual([]);
    expect(ev.ignores(".env")).toBe(false);
  });

  test("parses patterns, applies ignore matching", async () => {
    writeFileSync(join(tmp, ".gitignore"), "# comment\nnode_modules\n.env\n*.log\n");
    const ev = await gitignoreSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(true);
    expect(ev.patterns).toEqual(["node_modules", ".env", "*.log"]);
    expect(ev.ignores(".env")).toBe(true);
    expect(ev.ignores("node_modules/foo/bar.js")).toBe(true);
    expect(ev.ignores("error.log")).toBe(true);
    expect(ev.ignores("src/app.ts")).toBe(false);
  });

  test("strips blank lines and comments", async () => {
    writeFileSync(join(tmp, ".gitignore"), "\n# top comment\n\n.env\n\n# mid comment\ndist\n");
    const ev = await gitignoreSubsystem.gather({ cwd: tmp });
    expect(ev.patterns).toEqual([".env", "dist"]);
  });

  test("negation patterns work via ignore lib", async () => {
    writeFileSync(join(tmp, ".gitignore"), "*.log\n!keep.log\n");
    const ev = await gitignoreSubsystem.gather({ cwd: tmp });
    expect(ev.ignores("debug.log")).toBe(true);
    expect(ev.ignores("keep.log")).toBe(false);
  });
});
