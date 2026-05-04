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

- `descriptive-name` — kebab-case, describes the change (`add-rate-limiting`,
  `fix-login-redirect-loop`).
- `type` — one of: `feat`, `fix`, `breaking`, `perf`, `security`,
  `refactor`, `build`.

Examples:

```
.changes/add-rate-limiting.feat.md
.changes/fix-login-redirect-loop.fix.md
.changes/redesign-auth-api.breaking.md
```

## File format

YAML frontmatter + a one-paragraph description.

```markdown
---
type: FEAT
scope: api
---

Add token-bucket rate limiting on /api/* endpoints. Default 100 req/min
per IP; configurable via RATE_LIMIT env var.
```

### Frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `type` | yes | UPPERCASE: `FEAT`, `FIX`, `BREAKING`, `PERF`, `SECURITY`, `REFACTOR`, `BUILD`. Must match the filename suffix. |
| `scope` | yes | One word, kebab-case. Examples: `api`, `auth`, `ui`, `db`. |

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
# create a fragment
_scripts/changelog/create-fragment.sh -t feat -s api -n add-rate-limiting \
  -d "Add token-bucket rate limiting on /api/* endpoints."
```

## Why fragments?

- No merge conflicts on `CHANGELOG.md` — each PR writes a new file.
- Reviewable in isolation — the fragment is part of the PR diff.
- Bots can validate format pre-merge without parsing the whole changelog.
