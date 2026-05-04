# Briefs

Per-module mission briefs that decompose this spec into executable
units. One brief per surface, named so they sort in execution order:

```
briefs/
  01-cli-flag.md
  02-render-pipeline.md
  03-tests.md
```

## Why briefs

A spec answers *what* and *why*. A brief answers *how this one piece
gets done*. Each brief should be small enough to hand to a single
agent or contributor and self-contained enough to execute without
re-reading the whole spec.

## Brief shape

Each brief is a short Markdown file with these sections:

- **Goal** — one sentence, what this brief delivers.
- **Inputs** — files / contracts the brief reads from.
- **Outputs** — files / contracts the brief writes.
- **Steps** — ordered list of concrete actions.
- **Done when** — checklist that proves the brief landed.

If a brief grows past ~80 lines, split it.
