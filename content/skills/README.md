# content/skills/

Generic Claude Code skill markdown that ships into target repos via
`agentry add`. The Claude-flavoured side of the A+C hybrid distribution
split (see ADR-0001).

## Layout

Each capability is a directory containing the same three files:

```
content/skills/<capability>/
  skill.md     ← the operational walkthrough (when, why, steps)
  command.md   ← the slash-command stub (`/<capability>`) that points at skill.md
  rules.md     ← the full spec / contract
```

## Current capabilities

| Capability | What it covers |
|---|---|
| [`commits/`](commits/) | Conventional commits + fragment-required workflow |
| [`changelog/`](changelog/) | `.changes/` fragment authoring and rules |
| [`code-review/`](code-review/) | Prioritised diff review with verdict |
| [`pull-requests/`](pull-requests/) | What/Why/How PRs with test plan |

## What's *not* shipped here

- Stack-specific skills (e.g., `.NET coverage`, `npm lint`) — those
  belong in stack-overlay catalog entries that ship alongside their own
  stack-specific scripts.
- TeamPlanner-specific domain skills (`migrate-plugin`, `sonarcloud-sync`)
  — those stay in the originating project.
- Internal authoring helpers — those live in `../recipes/` so non-Claude
  tools can read them too.

## Conventions

- **Tool-agnostic content lives in `../recipes/`.** If a skill leans on
  Claude-specific syntax (`Use the Skill tool to...`), keep that here. If
  it could be read by any agent, write a recipe too.
- **One capability per directory.** A capability maps one-to-one to a
  catalog entry that `agentry add` can install.
- **No nested capabilities** in the v1 layout — flat is easier to reason
  about, and the catalog can compose multiple capabilities into one
  install if needed.
