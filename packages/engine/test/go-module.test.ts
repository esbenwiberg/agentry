import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { goModuleSubsystem } from "../src/evidence/subsystems/go-module.js";

function gitInit(cwd: string): void {
  execFileSync("git", ["init", "-q"], { cwd });
  execFileSync("git", ["add", "-A"], { cwd });
  execFileSync(
    "git",
    [
      "-c",
      "user.email=t@t",
      "-c",
      "user.name=t",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      ".",
    ],
    { cwd },
  );
}

describe("go_module subsystem", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-go-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("repo with no go.mod → empty", async () => {
    writeFileSync(join(tmp, "README.md"), "hi");
    gitInit(tmp);
    const ev = await goModuleSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
    expect(ev.modules).toEqual([]);
  });

  test("single go.mod → parses module path, go version, deps", async () => {
    writeFileSync(
      join(tmp, "go.mod"),
      `module github.com/example/app

go 1.22

require (
\tgithub.com/stretchr/testify v1.9.0
\tgolang.org/x/sync v0.7.0 // indirect
)

require github.com/spf13/cobra v1.8.0
`,
    );
    gitInit(tmp);
    const ev = await goModuleSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(true);
    expect(ev.modules).toHaveLength(1);
    const mod = ev.modules[0];
    expect(mod?.modulePath).toBe("github.com/example/app");
    expect(mod?.goVersion).toBe("1.22");
    expect(mod?.dependencies).toMatchObject({
      "github.com/stretchr/testify": "v1.9.0",
      "golang.org/x/sync": "v0.7.0",
      "github.com/spf13/cobra": "v1.8.0",
    });
  });

  test("nested go.mod files in a monorepo", async () => {
    mkdirSync(join(tmp, "services/api"), { recursive: true });
    mkdirSync(join(tmp, "services/worker"), { recursive: true });
    writeFileSync(join(tmp, "services/api/go.mod"), "module example.com/api\n\ngo 1.21\n");
    writeFileSync(join(tmp, "services/worker/go.mod"), "module example.com/worker\n\ngo 1.21\n");
    gitInit(tmp);
    const ev = await goModuleSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(true);
    expect(ev.modules).toHaveLength(2);
    expect(ev.modules.map((m) => m.modulePath).sort()).toEqual([
      "example.com/api",
      "example.com/worker",
    ]);
  });

  test("non-git repo → not present", async () => {
    writeFileSync(join(tmp, "go.mod"), "module example.com/x\n");
    const ev = await goModuleSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
  });
});
