---
type: FEAT
scope: catalog
---

Add the catalog schema and the first four entries (commits, changelog, code-review, pull-requests). Each entry is a TOML file under content/catalog/ describing what to install, where, and how doctor detects an existing install. Schema locked by ADR-0002 — TOML, one file per entry, per-file flavor (claude/agnostic), three conflict policies (prompt/overwrite/skip-if-exists), no merge, no remote sources, no template substitution. Capability scope is the union of [[provides]].target paths.
