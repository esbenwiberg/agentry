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
import {
  ACME_OVERLAY_DIR,
  makeGitRepoFixture,
  overlayRegistrationToml,
} from "./helpers/fixtures.js";

const ACME_TARGET = ".claude/skills/acme-base/skill.md";

async function makeRepoWithAcme(): Promise<string> {
  return makeGitRepoFixture({
    "agentry.overlays.toml": overlayRegistrationToml([
      { id: "acme", path: ACME_OVERLAY_DIR },
    ]),
  });
}

async function installAcmeBase(cwd: string): Promise<void> {
  const res = await runCli(["add", "acme-base", "--non-interactive"], { cwd });
  expect(res.code).toBe(0);
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

describe("agentry upgrade", () => {
  it("refreshes an out-of-date file (dest matches lockfile but not src)", async () => {
    const cwd = await makeRepoWithAcme();
    await installAcmeBase(cwd);
    const dest = resolve(cwd, ACME_TARGET);

    const stale = "STALE PRIOR VERSION\n";
    await writeFile(dest, stale);

    const lf = await readLockfile(cwd);
    expect(lf).not.toBeNull();
    const entry = findLockedEntry(lf, "acme-base");
    const provide = findLockedProvide(entry, ACME_TARGET);
    expect(provide).toBeDefined();
    provide!.checksum = sha256(stale);
    await writeLockfile(cwd, lf!);

    const res = await runCli(
      ["upgrade", "acme-base", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(dest, "utf8")).not.toBe(stale);
  });

  it("preserves user edits without --force", async () => {
    const cwd = await makeRepoWithAcme();
    await installAcmeBase(cwd);
    const dest = resolve(cwd, ACME_TARGET);
    const userText = "USER EDIT — not from catalog";
    await writeFile(dest, userText);

    const res = await runCli(
      ["upgrade", "acme-base", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(userText);
  });

  it("--force overwrites user edits", async () => {
    const cwd = await makeRepoWithAcme();
    await installAcmeBase(cwd);
    const dest = resolve(cwd, ACME_TARGET);
    await writeFile(dest, "USER EDIT");

    const res = await runCli(
      ["upgrade", "acme-base", "--non-interactive", "--force"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(readFileSync(dest, "utf8")).not.toBe("USER EDIT");
  });
});
