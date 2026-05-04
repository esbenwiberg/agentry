---
type: REFACTOR
scope: cli
---

Collapse remove's four-variant Outcome union into RemovalKind plus a force flag, mirroring the upgrade verb's pattern. Hide already-gone provides from the per-target plan and report them in a summary footer instead. Parallelise the unlink loop.
