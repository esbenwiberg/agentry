---
type: FEAT
scope: scan
---

agent-readiness gatherer now enumerates nested CLAUDE.md / AGENTS.md
files (any depth, ignore-list aware) with bytes + last-touched age, and
flags context-rot risk on any context file ≥32 KiB — Codex's documented
hard cap on the AGENTS.md chain (`project_doc_max_bytes`). The brief
gains a reading rule pointing the agent at these signals so it can
suggest splitting oversized roots and authoring nested context for
under-served subtrees.
