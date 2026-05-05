---
type: FEAT
scope: scan
---

agent-readiness gatherer expands its config-detection surface from 10
to 11 tools and adds many high-signal paths surfaced by the
agentic-readiness research: project MCP (`.mcp.json`,
`.cursor/mcp.json`), Claude Code skills/agents/commands/settings,
modern Cursor rules + sandbox + environment, Copilot path-scoped
instructions / prompts / Coding-Agent setup workflow, Codex
`AGENTS.override.md`, Aider `CONVENTIONS.md` + `.aiderignore`, Continue
config + rules, Windsurf rules + workflows, devcontainer + lockfile.

Also adds monorepo detection (`pnpm-workspace.yaml`, `nx.json`,
`turbo.json`, `lerna.json`, `rush.json`, `go.work`, `package.json`
workspaces, Cargo `[workspace]`) and emits a stale-signal when a
monorepo has zero nested CLAUDE.md / AGENTS.md — the documented
failure mode in Nx's published agent-failure analysis.
