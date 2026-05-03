# Architectural Decision Records

This directory holds **locked** decisions about <PROJECT_NAME>'s design.
They are numbered sequentially (`NNNN-kebab-title.md`) and never
renumbered.

## Conventions

- **One file = one decision.** Sub-decisions get new ADRs that link back.
- **Status field is mandatory.** Every ADR opens with `**Status:** ...`
  using one of: `Proposed`, `Accepted`, `Deprecated`, `Superseded by ADR-NNNN`.
- **Don't rewrite history.** Wrong decisions get superseded by new ADRs;
  the old file's status updates but its body doesn't.
- **Link, don't duplicate.** Related ADRs link by number.

## Numbering

Sequential, four digits, starting at 0000. To find the next:

```bash
ls docs/adr/ | grep -E '^[0-9]{4}-' | sort -r | head -1
```

## Workflow

1. **Argue** — open notes in `docs/decisions/` (unnumbered, free-form).
2. **Lock** — when the call is made, write a numbered ADR here.
3. **Revise** — write a new ADR that supersedes; update the old status.

## Template

See [template.md](template.md).

## Index

- [0000 — Record architectural decisions](0000-record-architecture-decisions.md)
- > *(append new ADRs here)*
