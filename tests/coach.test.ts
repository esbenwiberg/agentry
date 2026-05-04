import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";
import { makeRepoFixture } from "./helpers/fixtures.js";

describe("agentry coach", () => {
  it("claude-md writes CLAUDE.md with project name substituted", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(
      ["coach", "claude-md", "--non-interactive", "--name", "my-project"],
      { cwd },
    );
    expect(res.code).toBe(0);
    const claude = resolve(cwd, "CLAUDE.md");
    expect(existsSync(claude)).toBe(true);
    const text = readFileSync(claude, "utf8");
    expect(text).toContain("my-project");
    expect(text).not.toContain("<PROJECT_NAME>");
  });

  it("agent-profile writes .agent.toml with project name substituted", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(
      ["coach", "agent-profile", "--non-interactive", "--name", "my-project"],
      { cwd },
    );
    expect(res.code).toBe(0);
    const profile = resolve(cwd, ".agent.toml");
    expect(existsSync(profile)).toBe(true);
    const text = readFileSync(profile, "utf8");
    expect(text).toContain("my-project");
  });

  it("adr-init bootstraps docs/adr/ scaffold", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(
      ["coach", "adr-init", "--non-interactive", "--name", "my-project"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(resolve(cwd, "docs/adr/template.md"))).toBe(true);
    expect(existsSync(resolve(cwd, "docs/adr/README.md"))).toBe(true);
    expect(
      existsSync(
        resolve(cwd, "docs/adr/0000-record-architecture-decisions.md"),
      ),
    ).toBe(true);
  });

  it("spec-init bootstraps specs/ scaffold", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(
      ["coach", "spec-init", "--non-interactive"],
      { cwd },
    );
    expect(res.code).toBe(0);
    expect(existsSync(resolve(cwd, "specs/README.md"))).toBe(true);
    expect(existsSync(resolve(cwd, "specs/_template/purpose.md"))).toBe(true);
    expect(existsSync(resolve(cwd, "specs/_template/design.md"))).toBe(true);
    expect(existsSync(resolve(cwd, "specs/_template/acceptance.md"))).toBe(true);
    expect(
      existsSync(resolve(cwd, "specs/_template/briefs/README.md")),
    ).toBe(true);
  });

  it("rejects invalid coach kind", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(
      ["coach", "not-a-kind", "--non-interactive"],
      { cwd },
    );
    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain("unknown kind");
  });
});
