# Specs

Per-feature folders capturing the **purpose**, **design**, and **acceptance
criteria** for a chunk of work. Specs are the agentic equivalent of design
docs — they let an agent (or contributor) load a feature into context
without grepping commit history.

## Convention

- One folder per feature, kebab-cased: `specs/<feature-name>/`.
- Three core files: `purpose.md`, `design.md`, `acceptance.md`.
- Optional `briefs/` subfolder with per-module mission briefs that
  decompose the spec into executable units.
- Specs are **living** — update as scope shifts. Locked architectural
  decisions graduate to `docs/adr/` instead.

## Lifecycle

| Status | Meaning |
|---|---|
| `Draft` | Spec is being argued. Implementation has not started. |
| `Active` | Implementation in flight. |
| `Shipped` | Feature released. Spec stays as historical context. |
| `Abandoned` | Work cancelled. Keep the spec, mark status, link any follow-up. |

The status field on `purpose.md` is the source of truth.

## Naming

Slug must match `[a-z][a-z0-9-]*` and be ≤60 chars. Pick a name that
describes the *outcome*, not the *task* — `dark-mode`, not
`refactor-css-vars`.

## Relation to ADRs

Specs describe **what we're building and why**. ADRs describe **locked
architectural decisions**. A spec may cite ADRs; an ADR may cite a spec.
Don't duplicate content — link.

When a design call inside a spec hardens into a constraint that outlives
the feature, lift it into a numbered ADR and reference it from
`design.md`.

## Template

See [_template/](_template/). Copy the directory, or run:

```bash
agentry coach spec <slug> --title "Human title"
```

This auto-creates `specs/<slug>/` from the bundled template with the
title and date stamped in.

## Index

- > *(append new specs here as they reach `Active`, with a one-line summary)*
