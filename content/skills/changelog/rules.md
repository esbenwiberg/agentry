# Changelog Rules

The fragment-based changelog system. The same scheme `agentry`'s own
repo dogfoods (see `.changes/README.md`) — and what `agentry add changelog`
drops into target repos.

## Format

```
.changes/<name>.<type>.md
```

```markdown
---
type: TYPE
scope: scope
---

Description.
```

| Filename suffix | Frontmatter `type` | Required for commit type |
|---|---|---|
| `.feat.md` | `FEAT` | `feat` |
| `.fix.md` | `FIX` | `fix` |
| `.breaking.md` | `BREAKING` | `breaking` |
| `.perf.md` | `PERF` | `perf` |
| `.security.md` | `SECURITY` | `security` |
| `.refactor.md` | `REFACTOR` | `refactor` |
| `.build.md` | `BUILD` | `build` |

Frontmatter `type` is **uppercase** for legacy / readability reasons.

## When to create a fragment

Required for these commit types: `feat`, `fix`, `refactor`, `perf`,
`breaking`, `security`, `build`.

Skipped for: `test`, `docs`, `style`, `ci`, `chore`, `merge`, `revert`.

If you're committing fix to a doc typo it's `docs:` — no fragment. If
you're refactoring a public API, that's `refactor:` *and* `breaking:` —
two commits, two fragments, or one `breaking` fragment with a body
covering the full migration.

## Naming

Kebab-case, descriptive, prefixed by the change shape:

✅ Good:
- `add-user-authentication.feat.md`
- `fix-cache-race-condition.fix.md`
- `improve-query-performance.perf.md`
- `refactor-validation-logic.refactor.md`
- `redesign-auth-flow.breaking.md`

❌ Bad:
- `feature1.feat.md` (uninformative)
- `AddUserAuth.feat.md` (PascalCase)
- `fix_bug.fix.md` (snake_case)
- `update.feat.md` (no shape)

## Scope guidance

Match the commit's scope. Use the most specific subsystem name that's
still meaningful — typically a directory or service.

```
scope: api
scope: cli
scope: parser
scope: auth
scope: ui
```

Avoid kitchen-sink scopes (`core`, `app`) unless the change really does
span the whole system.

## Description guidance

One paragraph. 1–4 sentences. Active voice. Past tense reads stale in
release notes; prefer present tense or imperative ("Add X..." or
"Adds X...").

Write for someone reading the release notes who **has not seen the diff**.
Include enough context that they can decide:

- Does this affect me?
- Do I need to migrate / update / take action?
- Where do I learn more?

For breaking changes, name the migration path or link to one.

## Version bump rules

A release script merges all pending fragments and computes the next
semver:

| Highest fragment type present | Bump |
|---|---|
| `BREAKING` | MAJOR |
| `FEAT` | MINOR |
| `FIX`, `PERF`, `SECURITY` | PATCH |
| `REFACTOR`, `BUILD` only | tracked, no bump |

Highest priority wins. One `BREAKING` overrides any number of `FEAT`s.

## Generated CHANGELOG.md

Each pending fragment becomes one line under `[Unreleased]`:

```
- [TYPE] scope: description
```

Example:

```markdown
## [Unreleased]

- [FEAT] api: add user authentication endpoint
- [FIX] cache: resolve race condition in invalidation
- [BREAKING] api: redesign auth flow (see migration guide)

## [2.1.0] - 2026-04-21

- [FEAT] api: add project management endpoints
- [FIX] ui: resolve button alignment issue
```

The release script:

1. Reads `.changes/*.md`.
2. Parses frontmatter and body.
3. Inserts entries into `[Unreleased]`.
4. Computes and applies the next semver based on highest type.
5. Deletes consumed fragment files.

**Never edit `CHANGELOG.md` directly.** Always add a fragment.

## Hook enforcement

`commit-msg` rejects commits where:

- The type is fragment-required (`feat`, `fix`, ...) AND
- No fragment matching `^\.changes/.*\.(feat|fix|breaking|perf|security|refactor|build)\.md$` is staged.

Bypass policy: **don't**. If a fragment genuinely doesn't fit, you're
probably miscategorising the commit.

## One fragment per logical change

Don't combine unrelated changes in one fragment. If a single PR ships
two distinct features, that's two fragments, two commits.

## Migration content for BREAKING

For breaking changes, the description should answer: *what broke, and
how do consumers migrate?* Link to a migration guide if the answer is
longer than two sentences.

```markdown
---
type: BREAKING
scope: api
---

Renamed `/v1/users` to `/v2/users` and changed the response shape from
`{user}` to `{user, meta}`. See `docs/migration/v2.md` for client updates.
```

## Helpers

- `_scripts/changelog/create-fragment.sh` — bash creator.
- (Future) `_scripts/changelog/validate-fragment.sh` — format check.
- (Future) `_scripts/changelog/merge-fragments.sh` — release-time merger.

## Spec home

This file. Authoritative. The `commit-msg` hook implements a subset.
