import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.js";
import { makeRepoFixture } from "./helpers/fixtures.js";

interface ManifestShape {
  version: string;
  agentryVersion: string;
  scannedAt: string;
  cwd: string;
  options: { fitness: boolean; includeSource: boolean };
  gatherers: Array<{
    name: string;
    status: "ok" | "skipped" | "failed";
    durationMs: number;
    reason?: string;
    outputs: string[];
  }>;
  toolAvailability: Record<string, boolean>;
}

async function readManifest(bundleDir: string): Promise<ManifestShape> {
  const txt = await readFile(join(bundleDir, "manifest.json"), "utf8");
  return JSON.parse(txt) as ManifestShape;
}

async function findOnlyBundle(cwd: string): Promise<string> {
  const root = join(cwd, ".agentry", "scan");
  const entries = await readdir(root);
  expect(entries.length).toBe(1);
  return join(root, entries[0]!);
}

describe("agentry scan", () => {
  it("creates a bundle with manifest, catalog snapshot, and core gatherers", async () => {
    const cwd = await makeRepoFixture({
      "package.json": JSON.stringify({
        name: "demo",
        scripts: { build: "echo build" },
      }),
      "README.md": "# demo\n\nA tiny repo.\n",
      "src/index.ts": "export const x = 1;\n",
    });

    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("agentry scan");
    expect(res.stdout).toContain("(fitness skipped");

    const bundle = await findOnlyBundle(cwd);
    expect(existsSync(join(bundle, "manifest.json"))).toBe(true);
    expect(existsSync(join(bundle, "catalog.json"))).toBe(true);
    expect(existsSync(join(bundle, "structure", "tree.txt"))).toBe(true);
    expect(existsSync(join(bundle, "structure", "languages.json"))).toBe(true);
    expect(existsSync(join(bundle, "structure", "manifests.json"))).toBe(true);
    expect(existsSync(join(bundle, "hygiene", "checklist.json"))).toBe(true);
    expect(
      existsSync(join(bundle, "agent-readiness", "report.json")),
    ).toBe(true);
    expect(existsSync(join(bundle, "docs", "readme-head.md"))).toBe(true);

    const manifest = await readManifest(bundle);
    expect(manifest.version).toBe("1");
    expect(manifest.options.fitness).toBe(false);
    const names = manifest.gatherers.map((g) => g.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "structure",
        "git",
        "hygiene",
        "security",
        "agent-readiness",
        "docs",
        "fitness",
        "catalog",
      ]),
    );

    const fitness = manifest.gatherers.find((g) => g.name === "fitness");
    expect(fitness?.status).toBe("skipped");
  });

  it("skips git gatherer when not a git repo", async () => {
    const cwd = await makeRepoFixture({
      "README.md": "# demo\n",
    });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const bundle = await findOnlyBundle(cwd);
    const manifest = await readManifest(bundle);
    const git = manifest.gatherers.find((g) => g.name === "git");
    expect(git?.status).toBe("skipped");
  });

  it("catalog.json snapshot lists active entries with ids the agent can use", async () => {
    const cwd = await makeRepoFixture({ "README.md": "# demo\n" });
    const res = await runCli(["scan", "--no-fitness"], { cwd });
    expect(res.code).toBe(0);

    const bundle = await findOnlyBundle(cwd);
    const cat = JSON.parse(
      await readFile(join(bundle, "catalog.json"), "utf8"),
    ) as {
      entries: Array<{ id: string; layers: string[] }>;
      overlays: unknown[];
    };
    expect(Array.isArray(cat.entries)).toBe(true);
    expect(cat.entries.length).toBeGreaterThan(0);
    for (const e of cat.entries) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
    }
  });
});
