---
type: FEAT
scope: cli
---

Implement coach verb. Authors un-installable scaffolding by rendering content/templates/ with simple substitutions (project name, today's date, ADR number/title) and writing to the target repo. Subverbs: claude-md (root or --nested <subdir>), practices, adr-init (bootstrap docs/adr/), and adr <slug> (auto-numbered new ADR). Reuses the conflict prompt UX from add. parseArgs extended to capture flag values (--nested, --title, --name).
