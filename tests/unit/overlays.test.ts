import { describe, expect, it } from "vitest";
import { loadOverlays } from "../../src/overlays.js";
import { makeRepoFixture } from "../helpers/fixtures.js";

function manifest(
  id: string,
  opts: { version?: string; description?: string } = {},
): string {
  return [
    `id = "${id}"`,
    `version = "${opts.version ?? "0.1.0"}"`,
    `description = "${opts.description ?? "demo overlay"}"`,
  ].join("\n");
}

function registration(entries: Array<{ id: string; path: string }>): string {
  return entries
    .map((e) => [`[[overlay]]`, `id = "${e.id}"`, `path = "${e.path}"`].join("\n"))
    .join("\n\n");
}

function singleOverlayFixture(
  id: string,
  manifestBody: string | null,
): Record<string, string> {
  const files: Record<string, string> = {
    "agentry.overlays.toml": registration([{ id, path: `overlays/${id}` }]),
  };
  if (manifestBody !== null) {
    files[`overlays/${id}/agentry.overlay.toml`] = manifestBody;
  }
  return files;
}

describe("loadOverlays — file presence", () => {
  it("returns empty when agentry.overlays.toml is missing", async () => {
    const cwd = await makeRepoFixture();
    const r = loadOverlays(cwd);
    expect(r.overlays).toEqual([]);
    expect(r.malformed).toEqual([]);
  });

  it("returns empty when overlays.toml has no [[overlay]] tables", async () => {
    const cwd = await makeRepoFixture({ "agentry.overlays.toml": "" });
    const r = loadOverlays(cwd);
    expect(r.overlays).toEqual([]);
    expect(r.malformed).toEqual([]);
  });

  it("flags malformed TOML", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": "not = valid = toml = [garbage",
    });
    const r = loadOverlays(cwd);
    expect(r.overlays).toEqual([]);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/failed to parse/);
  });
});

describe("loadOverlays — registration validation", () => {
  it("parses a valid overlay end-to-end", async () => {
    const cwd = await makeRepoFixture(
      singleOverlayFixture("demo", manifest("demo")),
    );
    const r = loadOverlays(cwd);
    expect(r.malformed).toEqual([]);
    expect(r.overlays).toHaveLength(1);
    const o = r.overlays[0]!;
    expect(o.registrationId).toBe("demo");
    expect(o.manifest).toEqual({
      id: "demo",
      version: "0.1.0",
      description: "demo overlay",
    });
    expect(o.rootDir.endsWith("overlays/demo")).toBe(true);
  });

  it("rejects an id that violates ID_RE", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registration([
        { id: "@scope/name", path: "overlays/x" },
      ]),
      "overlays/x/agentry.overlay.toml": manifest("x"),
    });
    const r = loadOverlays(cwd);
    expect(r.overlays).toEqual([]);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/id must match/);
  });

  it("rejects a missing path", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": [`[[overlay]]`, `id = "demo"`].join("\n"),
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors).toContain(
      "overlay[0].path must be a non-empty string",
    );
  });

  it("rejects a path that does not exist", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registration([
        { id: "demo", path: "overlays/missing" },
      ]),
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/does not exist/);
  });

  it("rejects a path that is a file, not a directory", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registration([
        { id: "demo", path: "not-a-dir" },
      ]),
      "not-a-dir": "regular file",
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/not a directory/);
  });

  it("rejects duplicate registration ids", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registration([
        { id: "demo", path: "overlays/a" },
        { id: "demo", path: "overlays/b" },
      ]),
      "overlays/a/agentry.overlay.toml": manifest("demo"),
      "overlays/b/agentry.overlay.toml": manifest("demo"),
    });
    const r = loadOverlays(cwd);
    expect(r.overlays).toHaveLength(1);
    expect(r.overlays[0]!.rootDir.endsWith("overlays/a")).toBe(true);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/duplicates a prior registration/);
  });

  it("rejects a non-array overlay key", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": `overlay = "string-not-array"`,
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/array of tables/);
  });
});

describe("loadOverlays — manifest validation", () => {
  it("flags missing agentry.overlay.toml", async () => {
    const cwd = await makeRepoFixture({
      ...singleOverlayFixture("demo", null),
      "overlays/demo/.keep": "",
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.registrationId).toBe("demo");
    expect(r.malformed[0]!.errors[0]).toMatch(/not found in overlay root/);
  });

  it("flags malformed manifest TOML", async () => {
    const cwd = await makeRepoFixture(
      singleOverlayFixture("demo", "not = valid = toml = ["),
    );
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/failed to parse/);
  });

  it("flags manifest id mismatch", async () => {
    const cwd = await makeRepoFixture(
      singleOverlayFixture("demo", manifest("other-name")),
    );
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(
      /manifest\.id "other-name" does not match registration id "demo"/,
    );
  });

  it("flags non-semver manifest version", async () => {
    const cwd = await makeRepoFixture(
      singleOverlayFixture("demo", manifest("demo", { version: "not-semver" })),
    );
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/version must be valid semver/);
  });

  it("flags missing description", async () => {
    const cwd = await makeRepoFixture(
      singleOverlayFixture(
        "demo",
        [`id = "demo"`, `version = "0.1.0"`].join("\n"),
      ),
    );
    const r = loadOverlays(cwd);
    expect(r.malformed).toHaveLength(1);
    expect(r.malformed[0]!.errors[0]).toMatch(/description must be a string/);
  });

  it("loads multiple valid overlays in order", async () => {
    const cwd = await makeRepoFixture({
      "agentry.overlays.toml": registration([
        { id: "alpha", path: "overlays/alpha" },
        { id: "beta", path: "overlays/beta" },
      ]),
      "overlays/alpha/agentry.overlay.toml": manifest("alpha"),
      "overlays/beta/agentry.overlay.toml": manifest("beta"),
    });
    const r = loadOverlays(cwd);
    expect(r.malformed).toEqual([]);
    expect(r.overlays.map((o) => o.registrationId)).toEqual(["alpha", "beta"]);
  });
});
