import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AgentConfigEvidence, GatherContext, GuidanceFile } from "../../sdk/types.js";

// Known agent-guidance file names. A repo with any of these is "visible"
// to agent priors. Order is not significant.
export const GUIDANCE_CANDIDATES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".aider.conf.yml",
] as const;

export const agentConfigSubsystem = {
  id: "agent_config",
  version: "0.0.0",
  async gather(ctx: GatherContext): Promise<AgentConfigEvidence> {
    const root = ctx.cwd;
    const guidance: GuidanceFile[] = [];

    for (const name of GUIDANCE_CANDIDATES) {
      const full = join(root, name);
      if (existsSync(full)) {
        guidance.push({ path: name, bytes: statSync(full).size });
      }
    }

    const present = new Set(guidance.map((g) => g.path));

    return {
      guidance,
      has(path: string): boolean {
        return present.has(path);
      },
    };
  },
};
