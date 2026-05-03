# content/skills/

Generic Claude Code skill markdown that ships into target repos via
`agentry add`. These are the *Claude-flavoured* side of the A+C hybrid
distribution split (see ADR-0001).

## Format

Each skill is a self-contained Markdown file with a YAML-ish header
describing its trigger and the steps Claude should follow. Skills here
are **generic** — they assume nothing about the target repo's stack.

Stack-specific behaviour belongs in catalog entries that ship additional
skill files alongside their stack-specific scripts (e.g., a `.NET` add-on
ships a `coverage.dotnet.md` skill, not a generic `coverage.md`).

## What is *not* shipped

- Anything tightly coupled to TeamPlanner.
- Anything that only makes sense in a specific ecosystem unless gated
  behind a stack-specific catalog entry.
- Internal authoring helpers — those live in `../recipes/` so non-Claude
  tools can read them too.

## Status

Skills will be lifted from TeamPlanner's `.claude/skills/` and generalised
when `agentry add` lands. Until then, this directory is a placeholder.
