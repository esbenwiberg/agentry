---
type: FEAT
scope: scan
---

Add `agentry scan` and `agentry brief`. Scan writes a deterministic
evidence bundle to `.agentry/scan/<ts>/` (structure, git, hygiene,
security, agent-readiness, docs, fitness, catalog snapshot); fitness
tests run by default with `--no-fitness` to opt out. Brief renders
`instructions.md` against the latest bundle, inlining bundled practice
docs and a catalog snapshot so the user's coding agent can author from
evidence and re-scan to verify.
