import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { agentConfigSubsystem } from "../src/evidence/subsystems/agent-config.js";

describe("agent_config subsystem", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("empty repo → no guidance", async () => {
    const ev = await agentConfigSubsystem.gather({ cwd: tmp });
    expect(ev.guidance).toHaveLength(0);
    expect(ev.has("CLAUDE.md")).toBe(false);
  });

  test("CLAUDE.md present → found with byte and line count", async () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "# Hello agent\nLine two\nLine three\n");
    const ev = await agentConfigSubsystem.gather({ cwd: tmp });
    expect(ev.guidance).toHaveLength(1);
    expect(ev.guidance[0]?.path).toBe("CLAUDE.md");
    expect(ev.guidance[0]?.bytes).toBeGreaterThan(0);
    expect(ev.guidance[0]?.lines).toBe(3);
    expect(ev.has("CLAUDE.md")).toBe(true);
  });

  test("multiple guidance files all surface", async () => {
    writeFileSync(join(tmp, "CLAUDE.md"), "a");
    writeFileSync(join(tmp, "AGENTS.md"), "b");
    writeFileSync(join(tmp, ".cursorrules"), "c");
    mkdirSync(join(tmp, ".github"));
    writeFileSync(join(tmp, ".github", "copilot-instructions.md"), "d");
    const ev = await agentConfigSubsystem.gather({ cwd: tmp });
    const paths = ev.guidance.map((g) => g.path).sort();
    expect(paths).toEqual([
      ".cursorrules",
      ".github/copilot-instructions.md",
      "AGENTS.md",
      "CLAUDE.md",
    ]);
  });

  test("does not descend into subdirectories", async () => {
    const nested = join(tmp, "subdir");
    mkdirSync(nested);
    writeFileSync(join(nested, "CLAUDE.md"), "x");
    const ev = await agentConfigSubsystem.gather({ cwd: tmp });
    expect(ev.guidance).toHaveLength(0);
  });
});
