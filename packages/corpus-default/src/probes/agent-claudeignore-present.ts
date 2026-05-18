import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "agent.claudeignore-present",
  version: "1.0.0",
  dimensions: [{ id: "cost", weight: 0.6 }],
  tier: "static",
  evidence: ["agent_config", "size_stats"],

  rationale: `
    A .claudeignore file tells Claude Code which paths to skip when building
    context — generated files, build artifacts, large binaries, and vendored
    code that should never be read end-to-end. Without it, Claude may load
    expensive files that inflate token usage without adding signal. Only
    applies to repos that have opted into Claude (CLAUDE.md present).
  `,

  remediation:
    "Add a `.claudeignore` at the repo root using .gitignore syntax. Start by excluding build output (`dist/`, `build/`, `*.min.js`), generated code, large data files, and vendored dependencies that are already in node_modules.",

  async detect(ev) {
    const hasClaudeMd = ev.agent_config.guidance.some(
      (g) => g.path === "CLAUDE.md" || g.path.endsWith("/CLAUDE.md"),
    );
    if (!hasClaudeMd) {
      return { kind: "na", reason: "no CLAUDE.md" };
    }
    if (ev.size_stats.source === "none") {
      return { kind: "na", reason: "no git working tree" };
    }
    const present = ev.size_stats.files.some((f) => f.path === ".claudeignore");
    return { kind: "predicate", value: present };
  },

  score: { kind: "predicate", direction: "positive" },

  fixtures: [
    {
      name: "claudeignore-present",
      evidence: {
        agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 2000, lines: 60 }] },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 2100,
          totalFiles: 2,
          totalBytesEffective: 2100,
          totalFilesEffective: 2,
          files: [
            { path: "CLAUDE.md", bytes: 2000, lines: 60, depth: 0, generated: false },
            { path: ".claudeignore", bytes: 100, lines: 5, depth: 0, generated: false },
          ],
        },
      },
      expect: { reading: { kind: "predicate", value: true }, score: 100 },
    },
    {
      name: "claude-md-no-ignore",
      evidence: {
        agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 2000, lines: 60 }] },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 2000,
          totalFiles: 1,
          totalBytesEffective: 2000,
          totalFilesEffective: 1,
          files: [{ path: "CLAUDE.md", bytes: 2000, lines: 60, depth: 0, generated: false }],
        },
      },
      expect: { reading: { kind: "predicate", value: false }, score: 0 },
    },
    {
      name: "no-claude-md",
      evidence: {
        agent_config: { guidance: [{ path: "AGENTS.md", bytes: 2000, lines: 60 }] },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 2000,
          totalFiles: 1,
          totalBytesEffective: 2000,
          totalFilesEffective: 1,
          files: [{ path: "AGENTS.md", bytes: 2000, lines: 60, depth: 0, generated: false }],
        },
      },
      expect: { reading: { kind: "na", reason: "no CLAUDE.md" }, score: null },
    },
  ],
});
