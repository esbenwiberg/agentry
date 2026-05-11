import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore from "ignore";
import type { GatherContext, GitignoreEvidence } from "../../sdk/types.js";

export const gitignoreSubsystem = {
  async gather(ctx: GatherContext): Promise<GitignoreEvidence> {
    let raw: string;
    try {
      raw = await readFile(join(ctx.cwd, ".gitignore"), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { present: false, patterns: [], ignores: () => false };
      }
      throw err;
    }

    const patterns = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    const matcher = ignore().add(patterns);
    return {
      present: true,
      patterns,
      ignores: (path) => matcher.ignores(path),
    };
  },
};
