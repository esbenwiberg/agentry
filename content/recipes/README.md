# content/recipes/

Tool-agnostic prompt recipes — the *agnostic* side of the A+C hybrid
distribution split (see ADR-0001).

Where `../skills/` ships Claude Code-flavoured skill files, recipes here
are plain Markdown documents that any AI coding agent (Cursor, Aider,
Codex, a custom harness) can read and apply. They describe *what to do*
without prescribing how a specific tool should do it.

## Format

Each recipe is a Markdown file:

- **Title** — what the recipe accomplishes.
- **When to use** — the trigger.
- **Steps** — numbered, written for a human-or-agent reader. No
  Claude-specific syntax (`Use the Skill tool to...`).
- **Done when** — observable outcome.

## Why a separate tree?

If we only shipped Claude skills, `agentry` would be Claude-locked.
Recipes are the cross-tool compatibility layer — slower-moving, more
disciplined to write, but they're what makes the CLI tool-agnostic.

## Status

Recipes will be authored alongside the first `agentry add` entries. Until
then, this directory is a placeholder.
