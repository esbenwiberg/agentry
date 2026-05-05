import { existsSync, readFileSync } from "node:fs";
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

describe("agentry add", () => {
  it("installs an overlay artifact entry and writes a lockfile", async () => {
    const cwd = await makeRepoWithAcme();
    const res = await runCli(
      ["add", "acme-base", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(lockfilePath(cwd))).toBe(true);
    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).toContain('id = "acme-base"');
  });

  it("auto-installs declared dependencies in --non-interactive mode", async () => {
    const cwd = await makeRepoWithAcme();
    const res = await runCli(
      ["add", "acme-demo", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    const lock = readFileSync(lockfilePath(cwd), "utf8");
    expect(lock).toContain('id = "acme-demo"');
    expect(lock).toContain('id = "acme-base"');
  });

  it("--dry-run writes nothing", async () => {
    const cwd = await makeRepoWithAcme();
    const res = await runCli(
      ["add", "acme-base", "--non-interactive", "--dry-run"],
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
