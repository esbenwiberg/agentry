---
type: FEAT
scope: cli
---

Implement list and doctor verbs. list reads content/catalog/*.toml and prints id/name/description. doctor audits a target repo against each entry's detect.any_of and [[provides]].target paths, grouped by layer, reporting installed/partial/missing.
