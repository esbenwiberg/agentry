import type { BranchProtectionResult, GatherContext, GithubApiEvidence } from "../../sdk/types.js";
import { detectDefaultBranch, detectGithubRemote } from "../../util/git.js";

export const githubApiSubsystem = {
  gather(ctx: GatherContext): GithubApiEvidence {
    return {
      async branchProtection(branch?: string): Promise<BranchProtectionResult> {
        const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
        if (!token) return { kind: "unavailable", reason: "no GITHUB_TOKEN/GH_TOKEN in env" };

        const [remote, defaultBranch] = await Promise.all([
          detectGithubRemote(ctx.cwd),
          branch ? Promise.resolve(null) : detectDefaultBranch(ctx.cwd),
        ]);
        if (!remote) return { kind: "unavailable", reason: "no GitHub origin remote" };

        const target = branch ?? defaultBranch ?? "main";
        const url = `https://api.github.com/repos/${remote.owner}/${remote.repo}/branches/${target}/protection`;

        try {
          const res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          });
          if (res.status === 404) return { kind: "unprotected" };
          if (!res.ok) return { kind: "unavailable", reason: `github api ${res.status}` };
          return { kind: "protected" };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { kind: "unavailable", reason: `github api request failed: ${message}` };
        }
      },
    };
  },
};
