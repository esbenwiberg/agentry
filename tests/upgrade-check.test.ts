import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyLockfile,
  upsertLockedEntry,
  writeLockfile,
} from "../src/lockfile.js";
import { runCli } from "./helpers/cli.js";
import {
  ACME_OVERLAY_DIR,
  makeGitRepoFixture,
  makeRepoFixture,
  overlayRegistrationToml,
} from "./helpers/fixtures.js";

async function makeRepoWithAcme(): Promise<string> {
  return makeGitRepoFixture({
    "agentry.overlays.toml": overlayRegistrationToml([
      { id: "acme", path: ACME_OVERLAY_DIR },
    ]),
  });
}

describe("agentry doctor (removed)", () => {
  it("prints a deprecation pointer to upgrade --check / scan", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(["doctor"], { cwd });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("removed");
    expect(res.stderr).toContain("upgrade --check");
    expect(res.stderr).toContain("scan");
  });
});

describe("agentry upgrade --check", () => {
  it("no lockfile → exit 0 with explanatory message", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(["upgrade", "--check"], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("nothing to drift");
  });

  it("clean install → exit 0 with no drift", async () => {
    const cwd = await makeRepoWithAcme();
    const add = await runCli(["add", "acme-base", "--non-interactive"], { cwd });
    expect(add.code).toBe(0);

    const res = await runCli(["upgrade", "--check"], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("no drift");
  });

  it("user-edit drift → exit 1", async () => {
    const cwd = await makeRepoWithAcme();
    await runCli(["add", "acme-base", "--non-interactive"], { cwd });
    await writeFile(
      resolve(cwd, ".claude/skills/acme-base/skill.md"),
      "user-modified content",
    );

    const res = await runCli(["upgrade", "--check"], { cwd });
    expect(res.code).toBe(1);
    expect(res.stdout).toContain("user-edit");
  });

  it("orphaned overlay entry → exit 1", async () => {
    const cwd = await makeRepoFixture();
    const lf = upsertLockedEntry(emptyLockfile(), {
      id: "ghost-entry",
      version: "0.1.0",
      installed_at: "2026-01-01T00:00:00Z",
      overlay: "vanished",
      provides: [
        {
          target: ".claude/skills/ghost.md",
          source: "skills/ghost.md",
          flavor: "claude",
          checksum: "sha256:abc",
        },
      ],
    });
    await writeLockfile(cwd, lf);

    const res = await runCli(["upgrade", "--check"], { cwd });
    expect(res.code).toBe(1);
    expect(res.stdout).toContain("orphaned");
    expect(res.stdout).toContain("'vanished' is not registered");
  });

  it("orphaned bundled entry → exit 1", async () => {
    const cwd = await makeRepoFixture();
    const lf = upsertLockedEntry(emptyLockfile(), {
      id: "removed-bundled",
      version: "0.1.0",
      installed_at: "2026-01-01T00:00:00Z",
      provides: [
        {
          target: ".claude/skills/old.md",
          source: "skills/old.md",
          flavor: "claude",
          checksum: "sha256:abc",
        },
      ],
    });
    await writeLockfile(cwd, lf);

    const res = await runCli(["upgrade", "--check"], { cwd });
    expect(res.code).toBe(1);
    expect(res.stdout).toContain("no longer in bundled catalog");
  });
});
