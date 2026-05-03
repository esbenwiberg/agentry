# content/catalog/

The declarative manifest of what `agentry add` can install — and what
`agentry doctor` audits against.

## Layout

One TOML file per entry. Filename equals the entry's `id`. The CLI
globs `*.toml` to enumerate entries; there is no separate index file.

```
content/catalog/
  schema.md            ← the contract every entry follows
  README.md            ← this file
  commits.toml
  changelog.toml
  code-review.toml
  pull-requests.toml
```

## Current entries

| ID | Description | Layers |
|---|---|---|
| [`commits`](commits.toml) | Conventional commits + structured workflow | `harness`, `conventions` |
| [`changelog`](changelog.toml) | Fragment-based changelog | `harness`, `conventions` |
| [`code-review`](code-review.toml) | Prioritised diff review with verdict | `harness` |
| [`pull-requests`](pull-requests.toml) | What/Why/How PRs via `gh` | `harness`, `conventions` |

## Schema

See [schema.md](schema.md) for the field-by-field contract. Locked by
[ADR-0002](../../docs/adr/0002-catalog-schema.md).

Quick shape:

```toml
id = "..."
name = "..."
description = "..."
version = "0.1.0"

layers = ["harness", "conventions"]

[[provides]]
source   = "skills/.../skill.md"           # under content/
target   = ".claude/skills/.../skill.md"   # under target repo
flavor   = "claude"                        # claude | agnostic
conflict = "prompt"                        # prompt | overwrite | skip-if-exists

[detect]
any_of = ["..."]                           # paths that signal "installed"

[requires]
git     = true
entries = []                               # other catalog entry ids
tools   = []                               # external CLIs (soft check)
```

## How `agentry` consumes the catalog

- **`agentry list`** — reads every `*.toml`, filters out `deprecated_by`
  entries, prints id + name + description.
- **`agentry doctor`** — for each entry, checks `detect.any_of`; reports
  installed / missing / partial. Groups by `layers`.
- **`agentry add <id>`** — reads the entry, validates `requires`, copies
  each `[[provides]]` from `content/<source>` to `<target>` using its
  `conflict` policy. Pulls dependent entries from `requires.entries`
  with prompts.
- **`agentry coach <id>`** — references the entry to know what's
  installable scaffolding vs what needs the user to author.

## Adding a new entry

1. Pick an `id` (kebab-case, stable forever).
2. Create `content/catalog/<id>.toml` against [schema.md](schema.md).
3. Make sure every `source` path exists under `content/`.
4. Test that `detect.any_of` actually matches what the entry installs.
5. Document the entry in this README's table.
6. Commit (`feat(catalog)`) with a fragment.

## What this catalog does *not* support

- Remote sources (URLs in `source`). All content is in this repo.
- Template variable substitution. Files are copied byte-for-byte;
  placeholders live inside the source file.
- Markdown merging. Existing target files are kept, overwritten, or
  prompted on — never auto-merged.
- Stack-specific behaviour. That'll come from stack-overlay catalogs in
  separate repos (a future-phase concern).
