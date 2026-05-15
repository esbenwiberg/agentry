import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { dotnetProjectSubsystem } from "../src/evidence/subsystems/dotnet-project.js";

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

const CSPROJ_BASIC = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="Serilog" Version="3.1.1" />
  </ItemGroup>
</Project>
`;

const CSPROJ_CPM = `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFrameworks>net8.0;net9.0</TargetFrameworks>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore" />
    <PackageReference Include="Serilog" />
  </ItemGroup>
</Project>
`;

const DIRECTORY_PACKAGES_PROPS = `<Project>
  <ItemGroup>
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
    <PackageVersion Include="xunit" Version="2.6.0" />
  </ItemGroup>
</Project>
`;

describe("dotnet_project subsystem", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-dotnet-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("repo with no .NET files → not present", async () => {
    writeFileSync(join(tmp, "README.md"), "hi");
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(false);
  });

  test("single csproj → sdk, target framework, package refs parsed", async () => {
    writeFileSync(join(tmp, "App.csproj"), CSPROJ_BASIC);
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    expect(ev.present).toBe(true);
    expect(ev.projects).toHaveLength(1);
    const proj = ev.projects[0];
    expect(proj?.path).toBe("App.csproj");
    expect(proj?.kind).toBe("csproj");
    expect(proj?.sdk).toBe("Microsoft.NET.Sdk");
    expect(proj?.targetFrameworks).toEqual(["net8.0"]);
    expect(proj?.packageReferences).toEqual({
      "Newtonsoft.Json": "13.0.3",
      Serilog: "3.1.1",
    });
  });

  test("solution file detected", async () => {
    writeFileSync(
      join(tmp, "App.sln"),
      "Microsoft Visual Studio Solution File, Format Version 12\n",
    );
    writeFileSync(join(tmp, "App.csproj"), CSPROJ_BASIC);
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    expect(ev.solutions).toEqual(["App.sln"]);
  });

  test("Directory.Packages.props resolves versionless PackageReference", async () => {
    writeFileSync(join(tmp, "Directory.Packages.props"), DIRECTORY_PACKAGES_PROPS);
    writeFileSync(join(tmp, "App.csproj"), CSPROJ_CPM);
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    expect(ev.centralPackageManagement?.path).toBe("Directory.Packages.props");
    expect(ev.centralPackageManagement?.packageVersions).toMatchObject({
      "Microsoft.EntityFrameworkCore": "8.0.0",
      Serilog: "3.1.1",
      xunit: "2.6.0",
    });
    const proj = ev.projects[0];
    expect(proj?.packageReferences).toEqual({
      "Microsoft.EntityFrameworkCore": "8.0.0",
      Serilog: "3.1.1",
    });
    expect(proj?.targetFrameworks).toEqual(["net8.0", "net9.0"]);
  });

  test("Directory.Packages.props in parent dir applies to nested csproj", async () => {
    mkdirSync(join(tmp, "src/App"), { recursive: true });
    writeFileSync(join(tmp, "Directory.Packages.props"), DIRECTORY_PACKAGES_PROPS);
    writeFileSync(join(tmp, "src/App/App.csproj"), CSPROJ_CPM);
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    const proj = ev.projects[0];
    expect(proj?.packageReferences.Serilog).toBe("3.1.1");
    expect(proj?.packageReferences["Microsoft.EntityFrameworkCore"]).toBe("8.0.0");
  });

  test("fsproj and vbproj kinds recognised", async () => {
    writeFileSync(
      join(tmp, "Lib.fsproj"),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n',
    );
    writeFileSync(
      join(tmp, "Legacy.vbproj"),
      '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n',
    );
    gitInit(tmp);
    const ev = await dotnetProjectSubsystem.gather({ cwd: tmp });
    expect(ev.projects.map((p) => p.kind).sort()).toEqual(["fsproj", "vbproj"]);
  });
});
