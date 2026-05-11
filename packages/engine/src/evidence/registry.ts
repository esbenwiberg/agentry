import type { EvidenceMap, GatherContext } from "../sdk/types.js";
import { agentConfigSubsystem } from "./subsystems/agent-config.js";
import { filesSubsystem } from "./subsystems/files.js";

export async function gatherAll(ctx: GatherContext): Promise<EvidenceMap> {
  const [files, agentConfig] = await Promise.all([
    filesSubsystem.gather(ctx),
    agentConfigSubsystem.gather(ctx),
  ]);
  return { files, agent_config: agentConfig };
}
