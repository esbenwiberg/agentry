---
type: FEAT
scope: content
---

Add kernel rules (core-rules, quality-rules) and a templates tree (CLAUDE root + nested, PRACTICES, ADR README + template + seed ADR-0). Templates use a .template.md suffix so agentry's own context loader doesn't pick them up; the eventual installer renames on copy. Templates ship as fillable shells with placeholder questions, not pre-filled content.
