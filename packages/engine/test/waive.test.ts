import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { findingHash, waiveAdd, waiveLs, waiveRm } from "../src/cli/waive.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(path.join(tmpdir(), "repofit-waive-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function writeConfig(obj: Record<string, unknown>): void {
  writeFileSync(path.join(cwd, "repofit.config.json"), JSON.stringify(obj, null, 2));
}

function readConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(cwd, "repofit.config.json"), "utf8"));
}

describe("waive command", () => {
  test("findingHash is stable and 12 chars", () => {
    const a = findingHash("size.large-files", "vendor/big.json");
    const b = findingHash("size.large-files", "vendor/big.json");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    const c = findingHash("size.large-files", "vendor/other.json");
    expect(c).not.toBe(a);
  });

  test("add appends a waiver with the reason", async () => {
    writeConfig({ version: 1, gate: { mode: "advisory" } });
    const { stdout, exitCode } = await waiveAdd({
      cwd,
      probeId: "size.large-files",
      location: "vendor/big.json",
      reason: "vendor data, see ADR-7",
    });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/waived\s+size\.large-files\s+vendor\/big\.json/);
    expect(stdout).toMatch(/vendor data, see ADR-7/);
    const config = readConfig();
    expect(config.waivers).toEqual([
      {
        probeId: "size.large-files",
        location: "vendor/big.json",
        reason: "vendor data, see ADR-7",
      },
    ]);
  });

  test("add rejects empty reason", async () => {
    writeConfig({ version: 1, gate: { mode: "advisory" } });
    const { exitCode, stdout } = await waiveAdd({
      cwd,
      probeId: "size.large-files",
      location: "vendor/big.json",
      reason: "   ",
    });
    expect(exitCode).toBe(2);
    expect(stdout).toMatch(/--reason must be non-empty/);
  });

  test("add rejects bad expires", async () => {
    writeConfig({ version: 1, gate: { mode: "advisory" } });
    const { exitCode, stdout } = await waiveAdd({
      cwd,
      probeId: "size.large-files",
      location: "vendor/big.json",
      reason: "x",
      expires: "soon",
    });
    expect(exitCode).toBe(2);
    expect(stdout).toMatch(/--expires must be an ISO date/);
  });

  test("add refuses duplicates", async () => {
    writeConfig({
      version: 1,
      gate: { mode: "advisory" },
      waivers: [{ probeId: "size.large-files", location: "vendor/big.json", reason: "old reason" }],
    });
    const { exitCode, stdout } = await waiveAdd({
      cwd,
      probeId: "size.large-files",
      location: "vendor/big.json",
      reason: "new reason",
    });
    expect(exitCode).toBe(2);
    expect(stdout).toMatch(/already exists/);
  });

  test("ls reports 'no waivers' when none configured", async () => {
    writeConfig({ version: 1, gate: { mode: "advisory" } });
    const { stdout, exitCode } = await waiveLs({ cwd });
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/no waivers configured/);
  });

  test("ls prints hash + probe + path + reason", async () => {
    writeConfig({
      version: 1,
      gate: { mode: "advisory" },
      waivers: [
        { probeId: "size.large-files", location: "vendor/big.json", reason: "vendor data" },
      ],
    });
    const { stdout } = await waiveLs({ cwd });
    const hash = findingHash("size.large-files", "vendor/big.json");
    expect(stdout).toMatch(new RegExp(hash));
    expect(stdout).toMatch(/size\.large-files\s+vendor\/big\.json/);
    expect(stdout).toMatch(/vendor data/);
  });

  test("rm removes by hash", async () => {
    writeConfig({
      version: 1,
      gate: { mode: "advisory" },
      waivers: [
        { probeId: "size.large-files", location: "vendor/big.json", reason: "x" },
        { probeId: "docs.adr-presence", location: ".", reason: "y" },
      ],
    });
    const hash = findingHash("size.large-files", "vendor/big.json");
    const { exitCode } = await waiveRm({ cwd, hash });
    expect(exitCode).toBe(0);
    const config = readConfig();
    expect(config.waivers).toEqual([{ probeId: "docs.adr-presence", location: ".", reason: "y" }]);
  });

  test("rm deletes the waivers field when emptying it", async () => {
    writeConfig({
      version: 1,
      gate: { mode: "advisory" },
      waivers: [{ probeId: "x.y", location: "a", reason: "r" }],
    });
    const hash = findingHash("x.y", "a");
    await waiveRm({ cwd, hash });
    const config = readConfig();
    expect("waivers" in config).toBe(false);
  });

  test("rm errors on unknown hash", async () => {
    writeConfig({ version: 1, gate: { mode: "advisory" } });
    const { exitCode, stdout } = await waiveRm({ cwd, hash: "deadbeef" });
    expect(exitCode).toBe(2);
    expect(stdout).toMatch(/no waiver with hash 'deadbeef'/);
  });

  test("commands error helpfully when config is missing", async () => {
    await expect(waiveAdd({ cwd, probeId: "x.y", location: "a", reason: "r" })).rejects.toThrow(
      /Run 'repofit --init' first/,
    );
  });
});
