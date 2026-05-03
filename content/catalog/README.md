# content/catalog/

Declarative manifest of what `agentry add` can install into a target repo.

## What lives here

One TOML file per installable. Each describes:

- **id** — what the user types: `agentry add <id>`.
- **what** — human-readable summary.
- **provides** — list of files dropped into the target repo.
- **tool** — `claude`, `agnostic`, or both. Drives which content tree the
  install pulls from.
- **conflicts** — predeclared collision behaviour: `prompt`, `take-ours`,
  `take-theirs`.
- **prereqs** — soft checks (e.g., `.git` exists, `package.json` exists).

## Why TOML, not JSON

Hand-edited far more than parsed by us. Comments matter. JSON loses both.

## Status

Schema not locked. First entries land alongside the first usable
`agentry add` implementation. Until then, this directory is a placeholder.

## Out of scope

No capability enforcement runtime, no signing, no remote URL pull. See
ADR-0001.
