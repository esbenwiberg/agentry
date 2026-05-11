import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FilesEvidence, GatherContext } from "../../sdk/types.js";

export const filesSubsystem = {
  id: "files",
  version: "0.0.0",
  async gather(ctx: GatherContext): Promise<FilesEvidence> {
    const root = ctx.cwd;
    return {
      has(path: string): boolean {
        return existsSync(join(root, path));
      },
    };
  },
};
