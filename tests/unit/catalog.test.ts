import { describe, expect, it } from "vitest";
import { activeEntries, loadCatalog } from "../../src/catalog.js";
import { makeRepoFixture } from "../helpers/fixtures.js";

describe("loadCatalog (real bundled catalog)", () => {
  it("loads at least the kernel entries with no malformed errors", () => {
    const { entries, malformed } = loadCatalog();
    expect(malformed).toEqual([]);
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toContain("commits");
    expect(ids).toContain("changelog");
    expect(ids).toContain("code-review");
  });

  it("activeEntries excludes deprecated entries", () => {
    const { entries } = loadCatalog();
    const allIds = new Set(entries.map((e) => e.id));
    const active = activeEntries(entries);
    for (const a of active) {
      expect(a.deprecated_by).toBeUndefined();
    }
    for (const e of entries) {
      if (e.deprecated_by) {
        expect(allIds.has(e.deprecated_by)).toBe(true);
      }
    }
  });
});

describe("loadCatalog (fixture catalog)", () => {
  it("rejects an entry whose id does not match the filename stem", async () => {
    const dir = await makeRepoFixture({
      "wrong-id.toml": [
        `id = "different"`,
        `name = "X"`,
        `description = "X"`,
        `version = "0.1.0"`,
        ``,
        `[[provides]]`,
        `source = "skills/commits/skill.md"`,
        `target = ".claude/skills/x.md"`,
        `flavor = "claude"`,
        `conflict = "prompt"`,
        ``,
        `[detect]`,
        `any_of = [".claude/skills/x.md"]`,
      ].join("\n"),
    });
    const { entries, malformed } = loadCatalog(dir);
    expect(entries).toEqual([]);
    expect(malformed).toHaveLength(1);
    expect(malformed[0]!.errors.some((e) => e.includes("filename stem"))).toBe(true);
  });

  it("rejects an entry whose [[provides]] is missing", async () => {
    const dir = await makeRepoFixture({
      "no-provides.toml": [
        `id = "no-provides"`,
        `name = "X"`,
        `description = "X"`,
        `version = "0.1.0"`,
        ``,
        `[detect]`,
        `any_of = [".claude/skills/x.md"]`,
      ].join("\n"),
    });
    const { entries, malformed } = loadCatalog(dir);
    expect(entries).toEqual([]);
    expect(malformed).toHaveLength(1);
    expect(malformed[0]!.errors.some((e) => e.includes("provides"))).toBe(true);
  });

  it("detects cycles in requires.entries", async () => {
    const provideBlock = (id: string) =>
      [
        `[[provides]]`,
        `source = "skills/commits/skill.md"`,
        `target = ".claude/skills/${id}.md"`,
        `flavor = "claude"`,
        `conflict = "prompt"`,
        ``,
        `[detect]`,
        `any_of = [".claude/skills/${id}.md"]`,
      ].join("\n");

    const dir = await makeRepoFixture({
      "alpha.toml": [
        `id = "alpha"`,
        `name = "alpha"`,
        `description = "alpha"`,
        `version = "0.1.0"`,
        ``,
        provideBlock("alpha"),
        ``,
        `[requires]`,
        `entries = ["beta"]`,
      ].join("\n"),
      "beta.toml": [
        `id = "beta"`,
        `name = "beta"`,
        `description = "beta"`,
        `version = "0.1.0"`,
        ``,
        provideBlock("beta"),
        ``,
        `[requires]`,
        `entries = ["alpha"]`,
      ].join("\n"),
    });
    const { entries, malformed } = loadCatalog(dir);
    expect(entries).toEqual([]);
    expect(malformed.length).toBeGreaterThanOrEqual(2);
    expect(
      malformed.every((m) =>
        m.errors.some((err) => err.includes("cycle")),
      ),
    ).toBe(true);
  });
});
