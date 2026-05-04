import { describe, expect, it } from "vitest";
import {
  emptyLockfile,
  findLockedEntry,
  findLockedProvide,
  mergeLockedProvides,
  readLockfile,
  removeLockedEntry,
  upsertLockedEntry,
  writeLockfile,
  type LockedEntry,
} from "../../src/lockfile.js";
import { makeRepoFixture } from "../helpers/fixtures.js";

const sampleEntry: LockedEntry = {
  id: "commits",
  version: "0.2.0",
  installed_at: "2026-01-01T00:00:00Z",
  provides: [
    {
      target: ".claude/skills/commits/skill.md",
      source: "skills/commits/skill.md",
      flavor: "claude",
      checksum: "sha256:abc",
    },
    {
      target: ".githooks/commit-msg",
      source: "hooks/commit-msg",
      flavor: "agnostic",
      checksum: "sha256:def",
    },
  ],
};

describe("lockfile read/write", () => {
  it("readLockfile returns null when no lockfile exists", async () => {
    const cwd = await makeRepoFixture();
    expect(await readLockfile(cwd)).toBeNull();
  });

  it("readLockfile returns empty installed array on empty lockfile", async () => {
    const cwd = await makeRepoFixture();
    await writeLockfile(cwd, emptyLockfile());
    const lf = await readLockfile(cwd);
    expect(lf).not.toBeNull();
    expect(lf!.installed).toEqual([]);
  });

  it("round-trips an entry through write/read", async () => {
    const cwd = await makeRepoFixture();
    const lf = upsertLockedEntry(emptyLockfile(), sampleEntry);
    await writeLockfile(cwd, lf);
    const restored = await readLockfile(cwd);
    expect(restored).not.toBeNull();
    expect(restored!.installed).toHaveLength(1);
    expect(restored!.installed[0]!.id).toBe("commits");
    expect(restored!.installed[0]!.provides).toHaveLength(2);
    expect(restored!.installed[0]!.provides[0]!.checksum).toBe("sha256:abc");
  });

  it("readLockfile returns null on malformed TOML", async () => {
    const cwd = await makeRepoFixture({
      "agentry.lock.toml": "not = valid = toml = [garbage",
    });
    expect(await readLockfile(cwd)).toBeNull();
  });
});

describe("lockfile mutation helpers", () => {
  it("upsert replaces an existing entry by id", () => {
    const lf = upsertLockedEntry(emptyLockfile(), sampleEntry);
    const updated = upsertLockedEntry(lf, {
      ...sampleEntry,
      version: "0.3.0",
    });
    expect(updated.installed).toHaveLength(1);
    expect(updated.installed[0]!.version).toBe("0.3.0");
  });

  it("removeLockedEntry drops the matching id", () => {
    const lf = upsertLockedEntry(emptyLockfile(), sampleEntry);
    const after = removeLockedEntry(lf, "commits");
    expect(after.installed).toEqual([]);
  });

  it("findLockedEntry returns undefined when null lockfile", () => {
    expect(findLockedEntry(null, "commits")).toBeUndefined();
  });

  it("findLockedProvide returns the provide by target", () => {
    const provide = findLockedProvide(sampleEntry, ".githooks/commit-msg");
    expect(provide?.checksum).toBe("sha256:def");
  });

  it("mergeLockedProvides keeps fresh values and drops nothing from prior", () => {
    const prior = sampleEntry.provides;
    const fresh = [
      {
        target: ".claude/skills/commits/skill.md",
        source: "skills/commits/skill.md",
        flavor: "claude" as const,
        checksum: "sha256:NEW",
      },
    ];
    const merged = mergeLockedProvides(prior, fresh);
    const skill = merged.find((p) => p.target.endsWith("skill.md"));
    const hook = merged.find((p) => p.target.endsWith("commit-msg"));
    expect(skill?.checksum).toBe("sha256:NEW");
    expect(hook?.checksum).toBe("sha256:def");
  });
});
