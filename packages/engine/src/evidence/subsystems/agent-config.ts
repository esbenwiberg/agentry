import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentConfigEvidence, GatherContext, GuidanceFile } from "../../sdk/types.js";

export const GUIDANCE_CANDIDATES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".aider.conf.yml",
] as const;

export const agentConfigSubsystem = {
  async gather(ctx: GatherContext): Promise<AgentConfigEvidence> {
    const root = ctx.cwd;

    const found = await Promise.all(
      GUIDANCE_CANDIDATES.map(async (name): Promise<GuidanceFile | null> => {
        try {
          const s = await stat(join(root, name));
          return { path: name, bytes: s.size };
        } catch {
          return null;
        }
      }),
    );

    const guidance = found.filter((g): g is GuidanceFile => g !== null);
    const present = new Set(guidance.map((g) => g.path));

    return {
      guidance,
      has(path: string): boolean {
        return present.has(path);
      },
    };
  },
};
