# content/templates/

Skeleton template files. These are the *un-installable* bits made
*partially-installable*: the structure ships, the content does not.

## Why `.template.md`?

Files use the `.template.md` suffix so they don't get auto-loaded as
nested context by Claude Code (or any other tool) when scanning
agentry's own repo. The eventual installer (`agentry add` /
`agentry coach`) renames on copy:

```
content/templates/CLAUDE.template.md        →  <target>/CLAUDE.md
content/templates/CLAUDE.nested.template.md →  <target>/<subdir>/CLAUDE.md
content/templates/PRACTICES.template.md     →  <target>/PRACTICES.md
content/templates/agent.template.toml       →  <target>/.agent.toml
```

## Layout

```
content/templates/
  CLAUDE.template.md           ← root context skeleton
  CLAUDE.nested.template.md    ← per-subdir context skeleton
  PRACTICES.template.md        ← contributor conventions skeleton
  agent.template.toml          ← tool-agnostic project profile (.agent.toml)
  adr/
    README.template.md         ← ADR index
    template.md                ← ADR file template
    0000-record-architecture-decisions.template.md  ← seed ADR-0
```

## Posture

Templates are **shells with placeholders**, not pre-filled content. They
exist so the user (with or without `coach`'s help) can fill them in
honestly against their actual code. Pre-filled content would lie about
the project; an empty file would give the user nothing to react to.

A good placeholder reads like a question you have to answer:

```markdown
## Architecture

> Replace this with one or two sentences describing the architecture
> shape. Examples: "Hexagonal — domain in `src/core/`, adapters in
> `src/io/`." / "MVC monolith with a sidecar workers process."
```

## What is *not* shipped here

- Specs / briefs scaffolds — the spec convention is heavier and
  deserves its own round; deferred until we know the v1 shape better.
- Patterns templates (CQRS, CRUD, testing patterns, etc) — those are
  stack-specific and belong in stack overlays.
- Filled-in example projects — that's documentation, not template.
