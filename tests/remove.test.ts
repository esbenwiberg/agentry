import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lockfilePath } from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import {
  ACME_OVERLAY_DIR,
  makeGitRepoFixture,
  overlayRegistrationToml,
} from "./helpers/fixtures.js";

async function makeRepoWithAcme(): Promise<string> {
  return makeGitRepoFixture({
    "agentry.overlays.toml": overlayRegistrationToml([
      { id: "acme", path: ACME_OVERLAY_DIR },
    ]),
  });
}

describe("agentry remove", () => {
  it("deletes installed files and prunes the lockfile", async () => {
    const cwd = await makeRepoWithAcme();
    const add = await runCli(
      ["add", "acme-base", "--non-interactive"],
      { cwd },
    );
    expect(add.code).toBe(0);
    const target = resolve(cwd, ".claude/skills/acme-base/skill.md");
    expect(existsSync(target)).toBe(true);

    const res = await runCli(
      ["remove", "acme-base", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(target)).toBe(false);

    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).not.toContain('id = "acme-base"');
  });
});
