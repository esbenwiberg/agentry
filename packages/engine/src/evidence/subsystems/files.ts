import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FilesEvidence, GatherContext } from "../../sdk/types.js";

export const filesSubsystem = {
  async gather(ctx: GatherContext): Promise<FilesEvidence> {
    const root = ctx.cwd;
    return {
      has(path: string): boolean {
        return existsSync(join(root, path));
      },
      async readText(path: string): Promise<string | undefined> {
        try {
          return await readFile(join(root, path), "utf8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
          throw err;
        }
      },
    };
  },
};
