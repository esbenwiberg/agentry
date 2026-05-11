import type { EvidenceMap, GatherContext } from "../sdk/types.js";
import { agentConfigSubsystem } from "./subsystems/agent-config.js";
import { filesSubsystem } from "./subsystems/files.js";

// Phase 1: gather everything. Phase 2+ will honor declared evidence
// requirements and skip unused subsystems.
export async function gatherAll(ctx: GatherContext): Promise<EvidenceMap> {
  const [files, agentConfig] = await Promise.all([
    filesSubsystem.gather(ctx),
    agentConfigSubsystem.gather(ctx),
  ]);
  return { files, agent_config: agentConfig };
}
