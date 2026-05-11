import type { EvidenceMap, GatherContext } from "../sdk/types.js";
import { agentConfigSubsystem } from "./subsystems/agent-config.js";
import { filesSubsystem } from "./subsystems/files.js";
import { gitignoreSubsystem } from "./subsystems/gitignore.js";
import { nodePackageSubsystem } from "./subsystems/node-package.js";

export async function gatherAll(ctx: GatherContext): Promise<EvidenceMap> {
  const [files, agentConfig, nodePackage, gitignore] = await Promise.all([
    filesSubsystem.gather(ctx),
    agentConfigSubsystem.gather(ctx),
    nodePackageSubsystem.gather(ctx),
    gitignoreSubsystem.gather(ctx),
  ]);
  return {
    files,
    agent_config: agentConfig,
    node_package: nodePackage,
    gitignore,
  };
}
