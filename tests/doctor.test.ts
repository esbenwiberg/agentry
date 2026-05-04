import { describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";
import { makeRepoFixture } from "./helpers/fixtures.js";

describe("agentry doctor", () => {
  it("reports all entries as missing on an empty repo", async () => {
    const cwd = await makeRepoFixture();
    const res = await runCli(["doctor"], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("agentry doctor");
    expect(res.stdout).toMatch(/0 installed/);
    expect(res.stdout).toMatch(/no agentry\.lock\.toml/);
  });

  it("reports a partial install when only some provides exist", async () => {
    const cwd = await makeRepoFixture({
      ".claude/skills/commits/skill.md": "user-supplied content",
    });
    const res = await runCli(["doctor"], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toMatch(/commits\s+partial/);
  });
});
