---
type: FIX
scope: catalog
---

Detect cycles in requires.entries during catalog load. Cyclic entries are quarantined to malformed with a 'forms a cycle: a → b → a' diagnostic, instead of being silently broken at runtime by the dedup Set in resolvePlan.
