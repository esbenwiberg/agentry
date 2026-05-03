# Changelog Fragments

This directory holds **changelog fragments** — small per-change Markdown
files that get merged into `CHANGELOG.md` at release time.

You write a fragment per pull request. CI (or a release script) merges all
fragments, calculates the next version, updates `CHANGELOG.md`, and deletes
the fragments. **Never edit `CHANGELOG.md` directly.**

## Filename format

```
.changes/{descriptive-name}.{type}.md
```

- `descriptive-name` — kebab-case, describes the change (`add-doctor-verb`,
  `fix-hook-install-on-windows`).
- `type` — one of: `feat`, `fix`, `breaking`, `perf`, `security`,
  `refactor`, `build`.

Examples:

```
.changes/add-doctor-verb.feat.md
.changes/fix-hook-install-on-windows.fix.md
.changes/redesign-catalog-schema.breaking.md
```

## File format

YAML frontmatter + a one-paragraph description.

```markdown
---
type: FEAT
scope: cli
---

Add `agentry doctor` — read-only audit across 7 layers of agent-readiness.
Works on any repo without prior install.
```

### Frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `type` | yes | UPPERCASE: `FEAT`, `FIX`, `BREAKING`, `PERF`, `SECURITY`, `REFACTOR`, `BUILD`. Must match the filename suffix. |
| `scope` | yes | One word, kebab-case. Examples: `cli`, `catalog`, `hooks`, `docs`. |

### Body

One paragraph (1–4 sentences). Imperative-ish, present tense. Focus on
*what changed for the user*, not the internal mechanics.

## Version bumps

Fragment types map to semver bumps:

| Type | Bump |
|---|---|
| `BREAKING` | MAJOR |
| `FEAT` | MINOR |
| `FIX`, `PERF`, `SECURITY`, `REFACTOR`, `BUILD` | PATCH |

The largest bump across all pending fragments wins for a given release.

## Helpers

```bash
# create a fragment interactively
_scripts/changelog/create-fragment.sh -t feat -s cli -n add-doctor-verb \
  -d "Add agentry doctor — read-only audit across 7 layers."
```

## Why fragments?

- No merge conflicts on `CHANGELOG.md` — each PR writes a new file.
- Reviewable in isolation — the fragment is part of the PR diff.
- Bots can validate format pre-merge without parsing the whole changelog.

This pattern is the same one TeamPlanner uses, generalised for `agentry`'s
own use and (eventually) for `agentry add changelog` to drop into target
repos.
