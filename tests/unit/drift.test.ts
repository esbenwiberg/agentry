import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyProvideDrift } from "../../src/drift.js";
import { sha256OfFile, type LockedEntry } from "../../src/lockfile.js";
import { makeRepoFixture } from "../helpers/fixtures.js";

async function setup(opts: {
  srcContents?: string;
  destContents?: string;
}): Promise<{ src: string; dest: string; root: string }> {
  const root = await makeRepoFixture();
  const src = resolve(root, "src.md");
  const dest = resolve(root, "dest.md");
  if (opts.srcContents !== undefined) await writeFile(src, opts.srcContents);
  if (opts.destContents !== undefined) await writeFile(dest, opts.destContents);
  return { src, dest, root };
}

describe("classifyProvideDrift", () => {
  it("returns null when src does not exist", async () => {
    const { src, dest } = await setup({ destContents: "anything" });
    const result = await classifyProvideDrift(src, dest, "dest.md", undefined);
    expect(result).toBeNull();
  });

  it("returns null when dest matches src exactly", async () => {
    const { src, dest } = await setup({
      srcContents: "hello",
      destContents: "hello",
    });
    const result = await classifyProvideDrift(src, dest, "dest.md", undefined);
    expect(result).toBeNull();
  });

  it("returns 'missing' when dest does not exist", async () => {
    const { src, dest } = await setup({ srcContents: "hello" });
    const result = await classifyProvideDrift(src, dest, "dest.md", undefined);
    expect(result).toBe("missing");
  });

  it("returns 'out-of-date' when dest matches the locked checksum but not src", async () => {
    const { src, dest } = await setup({
      srcContents: "new content",
      destContents: "old content",
    });
    const lockedEntry: LockedEntry = {
      id: "x",
      version: "0.0.0",
      installed_at: "2026-01-01T00:00:00Z",
      provides: [
        {
          target: "dest.md",
          source: "src.md",
          flavor: "agnostic",
          checksum: await sha256OfFile(dest),
        },
      ],
    };
    const result = await classifyProvideDrift(src, dest, "dest.md", lockedEntry);
    expect(result).toBe("out-of-date");
  });

  it("returns 'user-edit' when dest differs from both src and the locked checksum", async () => {
    const { src, dest } = await setup({
      srcContents: "new content",
      destContents: "user edited content",
    });
    const lockedEntry: LockedEntry = {
      id: "x",
      version: "0.0.0",
      installed_at: "2026-01-01T00:00:00Z",
      provides: [
        {
          target: "dest.md",
          source: "src.md",
          flavor: "agnostic",
          checksum: "sha256:0000",
        },
      ],
    };
    const result = await classifyProvideDrift(src, dest, "dest.md", lockedEntry);
    expect(result).toBe("user-edit");
  });

  it("returns 'user-edit' when no lockfile entry exists and contents differ", async () => {
    const { src, dest } = await setup({
      srcContents: "a",
      destContents: "b",
    });
    const result = await classifyProvideDrift(src, dest, "dest.md", undefined);
    expect(result).toBe("user-edit");
  });
});
