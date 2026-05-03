# content/recipes/

Tool-agnostic prompt recipes — the agnostic side of the A+C hybrid
distribution split (see ADR-0001).

Where `../skills/` ships Claude Code-flavoured skill files (slash
commands, "Use the Skill tool to..."), recipes here are plain Markdown
documents that **any AI coding agent** (Cursor, Aider, Codex, a custom
harness) can read and apply. They describe *what to do* without
prescribing *how a specific tool should do it*.

## Layout

One directory per capability — same naming as `../skills/`:

```
content/recipes/<capability>/<recipe-name>.md
```

A capability can have multiple recipes (e.g., `code-review/` could host
`structured-review.md` and `security-only-review.md`).

## Current recipes

| Capability | Recipe |
|---|---|
| [`commits/`](commits/) | [conventional-commits.md](commits/conventional-commits.md) |
| [`changelog/`](changelog/) | [changelog-fragments.md](changelog/changelog-fragments.md) |
| [`code-review/`](code-review/) | [structured-review.md](code-review/structured-review.md) |
| [`pull-requests/`](pull-requests/) | [pr-template.md](pull-requests/pr-template.md) |

## Format

Each recipe has the same shape:

```markdown
# Recipe — <name>

## When to use
[trigger]

## Steps
1. ...
2. ...

## Done when
[observable outcome]

## Don't
[anti-patterns]
```

No tool-specific syntax. No "Use the X tool" — describe the *action*,
not the *call*. A reader wiring this into a non-Claude agent should be
able to without translation.

## Why a separate tree?

If we only shipped Claude skills, `agentry` would be Claude-locked.
Recipes are the cross-tool compatibility layer — slower-moving, more
disciplined to write, but they're what makes the CLI tool-agnostic.
