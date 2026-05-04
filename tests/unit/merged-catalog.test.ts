import { describe, expect, it } from "vitest";
import { loadMergedCatalog } from "../../src/merged-catalog.js";
import {
  makeRepoFixture,
  overlayManifestToml,
  overlayRegistrationToml,
} from "../helpers/fixtures.js";

interface OverlayEntryOpts {
  id: string;
  /** target filename under .claude/skills/ */
  target?: string;
  /** extra TOML lines (e.g. [requires] block) */
  extra?: string[];
  version?: string;
}

function overlayEntryToml(opts: OverlayEntryOpts): string {
  const target = opts.target ?? `.claude/skills/${opts.id}.md`;
  const lines = [
    `id = "${opts.id}"`,
    `name = "X"`,
    `description = "X"`,
    `version = "${opts.version ?? "0.1.0"}"`,
    ``,
    `[[provides]]`,
    `source = "skills/${opts.id}/skill.md"`,
    `target = "${target}"`,
    `flavor = "claude"`,
    `conflict = "prompt"`,
    ``,
    `[detect]`,
    `any_of = ["${target}"]`,
  ];
  if (opts.extra) lines.push(``, ...opts.extra);
  return lines.join("\n");
}

function overlayFiles(
  overlayId: string,
  entries: OverlayEntryOpts[],
): Record<string, string> {
  const files: Record<string, string> = {
    [`overlays/${overlayId}/agentry.overlay.toml`]: overlayManifestToml(overlayId),
  };
  for (const e of entries) {
    files[`overlays/${overlayId}/catalog/${e.id}.toml`] = overlayEntryToml(e);
    files[`overlays/${overlayId}/skills/${e.id}/skill.md`] = `# ${e.id}`;
  }
  return files;
}

function registerOverlays(ids: string[]): string {
  return overlayRegistrationToml(
    ids.map((id) => ({ id, path: `overlays/${id}` })),
  );
}

describe("loadMergedCatalog — bundled only", () => {
  it("returns bundled catalog when no overlays.toml exists", async () => {
    const cwd = await makeRepoFixture();
    const r = loadMergedCatalog(cwd);
    expect(r.malformed).toEqual([]);
    expect(r.overlayLoadErrors).toEqual([]);
    expect(r.shadowed).toEqual([]);
    expect(r.entries.map((e) => e.id)).toContain("commits");
    for (const entry of r.entries) {
      expect(entry.overlay).toBeUndefined();
    }
  });
});

describe("loadMergedCatalog — overlay merging", () => {
  it("adds an overlay-only entry", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["demo"]),
      ...overlayFiles("demo", [{ id: "lint" }]),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.malformed).toEqual([]);
    expect(r.shadowed).toEqual([]);
    const lint = r.entries.find((e) => e.id === "lint");
    expect(lint).toBeDefined();
    expect(lint!.overlay).toBe("demo");
    expect(lint!.sourceFile).toContain("overlays/demo/catalog/lint.toml");
  });

  it("overlay entry shadows a bundled entry with the same id (last-wins)", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["demo"]),
      ...overlayFiles("demo", [{ id: "commits" }]),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.malformed).toEqual([]);
    const commits = r.entries.find((e) => e.id === "commits");
    expect(commits!.overlay).toBe("demo");

    const shadowedCommits = r.shadowed.find((e) => e.id === "commits");
    expect(shadowedCommits).toBeDefined();
    expect(shadowedCommits!.overlay).toBeUndefined();
  });

  it("registers two overlays — later registration wins on collision", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["alpha", "beta"]),
      ...overlayFiles("alpha", [{ id: "lint" }]),
      ...overlayFiles("beta", [{ id: "lint" }]),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.malformed).toEqual([]);
    const lint = r.entries.find((e) => e.id === "lint");
    expect(lint!.overlay).toBe("beta");

    const shadowed = r.shadowed.find((e) => e.id === "lint");
    expect(shadowed!.overlay).toBe("alpha");
  });

  it("overlay-only entry can require a bundled entry (cross-source dep)", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["demo"]),
      ...overlayFiles("demo", [
        {
          id: "needs-commits",
          extra: [`[requires]`, `entries = ["commits"]`],
        },
      ]),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.malformed).toEqual([]);
    expect(r.entries.find((e) => e.id === "needs-commits")).toBeDefined();
  });

  it("overlay entry referencing an unknown id is reported malformed (cross-ref runs once on merged set)", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["demo"]),
      ...overlayFiles("demo", [
        {
          id: "needs-ghost",
          extra: [`[requires]`, `entries = ["does-not-exist"]`],
        },
      ]),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.entries.find((e) => e.id === "needs-ghost")).toBeUndefined();
    const m = r.malformed.find((m) => m.id === "needs-ghost");
    expect(m).toBeDefined();
    expect(m!.overlay).toBe("demo");
    expect(m!.errors.some((e) => e.includes("unknown id"))).toBe(true);
  });

  it("malformed overlay entry colliding with bundled: bundled stays + malformed reported", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registerOverlays(["demo"]),
      ...overlayFiles("demo", [{ id: "commits", version: "not-semver" }]),
    });
    const r = loadMergedCatalog(cwd);

    const commits = r.entries.find((e) => e.id === "commits");
    expect(commits).toBeDefined();
    expect(commits!.overlay).toBeUndefined(); // bundled survived

    const malformed = r.malformed.find((m) => m.id === "commits");
    expect(malformed).toBeDefined();
    expect(malformed!.overlay).toBe("demo");
  });

  it("malformed overlay registration is reported via overlayLoadErrors, not malformed", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": [
        `[[overlay]]`,
        `id = "broken"`,
        `path = "overlays/missing-dir"`,
      ].join("\n"),
    });
    const r = loadMergedCatalog(cwd);
    expect(r.overlayLoadErrors).toHaveLength(1);
    expect(r.overlayLoadErrors[0]!.errors[0]).toMatch(/does not exist/);
  });
});
