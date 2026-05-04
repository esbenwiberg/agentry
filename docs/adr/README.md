# Architectural Decision Records

This directory holds **locked** decisions about agentry's design. They are
numbered sequentially (`NNNN-kebab-title.md`) and never renumbered.

## Conventions

- **One file = one decision.** If a decision spawns sub-decisions, write
  new ADRs that link back.
- **Status field is mandatory.** Every ADR opens with `**Status:** ...`
  using one of: `Proposed`, `Accepted`, `Deprecated`, `Superseded by ADR-NNNN`.
- **Don't rewrite history.** When an ADR is wrong, write a new one that
  supersedes it and update the old one's status. Do not edit the original.
- **Link, don't duplicate.** When two ADRs are related, link them by number.

## Numbering

Sequential, four digits, starting at 0000. Each new ADR uses the next
number. To find the next number:

```bash
ls docs/adr/ | grep -E '^[0-9]{4}-' | sort -r | head -1
```

## Workflow

1. **Argue** — open notes in `docs/decisions/` (unnumbered, free-form).
   Iterate freely.
2. **Lock** — when the call is made, write a numbered ADR here. Status:
   `Accepted`. Delete or archive the corresponding `decisions/` notes.
3. **Revise** — write a new ADR that supersedes. Update the old status.

## Template

See [template.md](template.md).

## Index

- [0000 — Record architectural decisions](0000-record-architecture-decisions.md)
- [0001 — Product posture: doctor / add / coach](0001-product-posture-doctor-add-coach.md) — amended by 0004
- [0002 — Catalog schema](0002-catalog-schema.md)
- [0003 — Agent profile schema (`.agent.toml`)](0003-agent-profile-schema.md)
- [0004 — Overlay plugin model](0004-overlay-plugin-model.md)
