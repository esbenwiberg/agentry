---
type: FEAT
scope: scan
---

agent-readiness gatherer adds two new signals tied to documented
agentic-failure modes: (1) local-config gitignore audit — flags
`CLAUDE.local.md` and `.claude/settings.local.json` not covered by
`.gitignore` when Claude Code is in use; (2) fitness-command
reachability — flags package.json scripts / Makefile targets that
exist but aren't named in any agent-context doc (`CLAUDE.md`,
`AGENTS.md`, `.agent.toml`, `.github/copilot-instructions.md`,
`PRACTICES.md`, `CONTRIBUTING.md`), the documented Devin failure
mode where autonomous runners synthesize wrong commands.
