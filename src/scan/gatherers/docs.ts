import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Gatherer, GathererContext } from "../types.js";

const README_CANDIDATES = ["README.md", "README.rst", "README", "README.txt"];
const MAX_README_LINES = 200;

async function captureReadmeHead(
  cwd: string,
): Promise<{ path: string; head: string } | null> {
  for (const name of README_CANDIDATES) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      try {
        const txt = await readFile(path, "utf8");
        const head = txt.split("\n").slice(0, MAX_README_LINES).join("\n");
        return { path: name, head };
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function rootHeadings(cwd: string): Promise<
  Array<{ file: string; firstHeading: string; bytes: number }>
> {
  let entries: string[] = [];
  try {
    entries = readdirSync(cwd);
  } catch {
    return [];
  }
  const out: Array<{ file: string; firstHeading: string; bytes: number }> = [];
  for (const f of entries) {
    if (!/\.md$/i.test(f)) continue;
    const full = resolve(cwd, f);
    let bytes = 0;
    try {
      bytes = statSync(full).size;
    } catch {
      continue;
    }
    let firstHeading = "";
    try {
      const txt = await readFile(full, "utf8");
      const m = txt.match(/^#\s+(.+)$/m);
      firstHeading = m ? m[1]!.trim() : "";
    } catch {
      /* ignore */
    }
    out.push({ file: f, firstHeading, bytes });
  }
  return out;
}

async function captureClaudeMd(
  cwd: string,
): Promise<{ path: string; content: string } | null> {
  const path = resolve(cwd, "CLAUDE.md");
  if (!existsSync(path)) return null;
  try {
    const content = await readFile(path, "utf8");
    return { path: "CLAUDE.md", content };
  } catch {
    return null;
  }
}

export const docsGatherer: Gatherer = {
  name: "docs",
  async run(ctx: GathererContext): Promise<string[]> {
    const dir = join(ctx.bundleDir, "docs");
    await mkdir(dir, { recursive: true });

    const readme = await captureReadmeHead(ctx.cwd);
    const headings = await rootHeadings(ctx.cwd);
    const claude = await captureClaudeMd(ctx.cwd);

    const outputs: string[] = [];

    if (readme) {
      await writeFile(join(dir, "readme-head.md"), readme.head);
      outputs.push("docs/readme-head.md");
    }
    await writeFile(
      join(dir, "root-headings.json"),
      JSON.stringify(headings, null, 2),
    );
    outputs.push("docs/root-headings.json");

    if (claude) {
      await writeFile(join(dir, "claude-md.md"), claude.content);
      outputs.push("docs/claude-md.md");
    }
    return outputs;
  },
};
