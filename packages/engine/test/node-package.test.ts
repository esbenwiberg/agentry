import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { nodePackageSubsystem } from "../src/evidence/subsystems/node-package.js";

describe("node_package subsystem", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("missing package.json → not present", async () => {
    const ev = await nodePackageSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
    expect(ev.dependencies).toEqual({});
    expect(ev.raw).toBeNull();
  });

  test("malformed json → not present (does not throw)", async () => {
    writeFileSync(join(tmp, "package.json"), "{not json");
    const ev = await nodePackageSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
  });

  test("valid package.json surfaces deps, devDeps, scripts", async () => {
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({
        name: "x",
        dependencies: { commander: "^14" },
        devDependencies: { vitest: "^4", "@types/node": "^22" },
        scripts: { test: "vitest", build: "tsc" },
      }),
    );
    const ev = await nodePackageSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(true);
    expect(ev.dependencies).toEqual({ commander: "^14" });
    expect(ev.devDependencies.vitest).toBe("^4");
    expect(ev.scripts.test).toBe("vitest");
  });

  test("non-string script values are dropped", async () => {
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ scripts: { test: "vitest", bad: 42, also_bad: null } }),
    );
    const ev = await nodePackageSubsystem.gather({ cwd: tmp });
    expect(ev.scripts).toEqual({ test: "vitest" });
  });
});
