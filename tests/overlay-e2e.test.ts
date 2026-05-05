import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findLockedEntry, readLockfile } from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import {
  ACME_OVERLAY_DIR,
  makeGitRepoFixture,
  overlayRegistrationToml,
} from "./helpers/fixtures.js";

const ACME_TARGET = ".claude/skills/acme-demo/skill.md";

async function makeRepoWithAcme(): Promise<string> {
  return makeGitRepoFixture({
    "agentry.overlays.toml": overlayRegistrationToml([
      { id: "acme", path: ACME_OVERLAY_DIR },
    ]),
  });
}

describe("overlay e2e — acme fixture", () => {
  it("list surfaces overlay-shipped entries with attribution", async () => {
    const cwd = await makeRepoWithAcme();
    const res = await runCli(["list", cwd], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/acme-demo\b.*\[overlay:acme\]/);
  });

  it("add installs an overlay entry and records overlay in the lockfile", async () => {
    const cwd = await makeRepoWithAcme();
    const res = await runCli(
      ["add", "acme-demo", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(resolve(cwd, ACME_TARGET))).toBe(true);

    const lf = await readLockfile(cwd);
    const locked = findLockedEntry(lf, "acme-demo");
    expect(locked?.overlay).toBe("acme");
    expect(locked?.provides[0]?.target).toBe(ACME_TARGET);
  });

  it("upgrade --check reports no drift on a clean overlay install", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-demo", "--non-interactive"], { cwd });
    const res = await runCli(["upgrade", "--check", cwd], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("no drift");
  });

  it("upgrade detects user-edit drift on an overlay entry", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-demo", "--non-interactive"], { cwd });
    await writeFile(resolve(cwd, ACME_TARGET), "user-modified content\n");
    const res = await runCli(
      ["upgrade", "acme-demo", "--non-interactive", "--dry-run"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("user-edit");
  });

  it("upgrade --check flags orphaned when the overlay is deregistered post-install", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-demo", "--non-interactive"], { cwd });
    // Drop the acme registration; lockfile still claims overlay = "acme"
    await writeFile(resolve(cwd, "agentry.overlays.toml"), "");

    const res = await runCli(["upgrade", "--check", cwd], { cwd });
    expect(res.code).toBe(1);
    expect(res.stdout).toContain("orphaned");
    expect(res.stdout).toContain("'acme' is not registered");
  });

  it("remove uninstalls an overlay entry cleanly", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-demo", "--non-interactive"], { cwd });
    const res = await runCli(
      ["remove", "acme-demo", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(resolve(cwd, ACME_TARGET))).toBe(false);
    const lf = await readLockfile(cwd);
    expect(findLockedEntry(lf, "acme-demo")).toBeUndefined();
  });

  it("upgrade --force restores an overlay entry from its overlay-rooted source", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-demo", "--non-interactive"], { cwd });
    const dest = resolve(cwd, ACME_TARGET);
    const original = readFileSync(dest, "utf8");
    await writeFile(dest, "user-modified content\n");

    const res = await runCli(
      ["upgrade", "acme-demo", "--non-interactive", "--force"],
      { cwd },
    );
    expect(res.code).toBe(0);
    // Restored by reading the overlay's own source tree, not bundled CONTENT_DIR
    expect(readFileSync(dest, "utf8")).toBe(original);
  });
});
