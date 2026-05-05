import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";
import {
  ACME_OVERLAY_DIR,
  makeGitRepoFixture,
  makeRepoFixture,
  overlayRegistrationToml,
} from "./helpers/fixtures.js";

const CWD = tmpdir();

async function makeRepoWithAcme(): Promise<string> {
  return makeGitRepoFixture({
    "agentry.overlays.toml": overlayRegistrationToml([
      { id: "acme", path: ACME_OVERLAY_DIR },
    ]),
  });
}

describe("agentry CLI dispatch", () => {
  it("prints help with no verb", async () => {
    const res = await runCli([], { cwd: CWD });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Usage:");
    expect(res.stdout).toContain("agentry list");
  });

  it.each(["--help", "-h"])("prints help with %s", async (flag) => {
    const res = await runCli([flag], { cwd: CWD });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Usage:");
  });

  it.each(["--version", "-v"])("prints version with %s", async (flag) => {
    const res = await runCli([flag], { cwd: CWD });
    expect(res.code).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("rejects an unknown verb with exit 1", async () => {
    const res = await runCli(["frobnicate"], { cwd: CWD });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("unknown command");
  });

  it("requires an id for add", async () => {
    const res = await runCli(["add"], { cwd: CWD });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("missing entry id");
  });

  it("requires an id for remove", async () => {
    const res = await runCli(["remove"], { cwd: CWD });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("missing entry id");
  });

  it("requires a kind for coach", async () => {
    const res = await runCli(["coach"], { cwd: CWD });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("unknown kind");
  });

  it("rejects an unknown coach kind", async () => {
    const res = await runCli(["coach", "frobnicate"], { cwd: CWD });
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("unknown kind");
  });
});

describe("agentry CLI flag parsing", () => {
  it.each(["--nested=docs", "--nested docs"])(
    "accepts %s syntax",
    async (form) => {
      const cwd = await makeRepoFixture();
      await mkdir(resolve(cwd, "docs"));
      const res = await runCli(
        ["coach", "claude-md", ...form.split(" "), "--non-interactive"],
        { cwd },
      );
      expect(res.code).toBe(0);
      expect(res.stdout + res.stderr).toContain("docs/CLAUDE.md");
    },
  );
});

describe("agentry upgrade arg disambiguation", () => {
  it("treats a path-shaped first arg as cwd, not as an id", async () => {
    // fixtureA has an installed entry → a real lockfile.
    // fixtureB is empty. If disambiguation is broken and the path-shaped
    // arg gets treated as id, the upgrade would succeed against fixtureA's
    // lockfile. We require it to error against fixtureB instead.
    const fixtureA = await makeRepoWithAcme();
    const install = await runCli(
      ["add", "acme-base", "--non-interactive"],
      { cwd: fixtureA },
    );
    expect(install.code).toBe(0);
    const fixtureB = await makeRepoFixture();

    const res = await runCli(
      ["upgrade", fixtureB, "--non-interactive"],
      { cwd: fixtureA },
    );
    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain("no agentry.lock.toml");
  });

  it("treats an id-shaped first arg as an id, keeping cwd intact", async () => {
    // The id is resolved against the lockfile in cwd. We prove disambiguation
    // by confirming the failure references the id ('not-installed'), not the
    // missing-lockfile message that a path-shaped arg would produce.
    const fixtureA = await makeRepoWithAcme();
    const install = await runCli(
      ["add", "acme-base", "--non-interactive"],
      { cwd: fixtureA },
    );
    expect(install.code).toBe(0);

    const res = await runCli(
      ["upgrade", "not-installed", "--non-interactive"],
      { cwd: fixtureA },
    );
    expect(res.stderr).toContain("'not-installed'");
    expect(res.stderr).not.toContain("no agentry.lock.toml");
  });
});
