# Changelog scripts

Bash helpers for working with `.changes/` fragments.

## `create-fragment.sh`

Creates a new fragment file under `.changes/`.

```bash
_scripts/changelog/create-fragment.sh \
  -t feat \
  -s api \
  -n add-rate-limiting \
  -d "Add token-bucket rate limiting on /api/* endpoints."
```

Validates type, kebab-case name + scope, refuses to overwrite. Writes the
file with proper YAML frontmatter.

## (Future) merge / version scripts

A typical release pipeline walks `.changes/`, computes the next semver,
updates `CHANGELOG.md`, and deletes consumed fragments. Until that lands
in your project, fragments accumulate and CI doesn't fail on missing
release tooling.

When you build that release script, it should:

- group fragments by `type:` (BREAKING / FEAT / FIX / …)
- pick the largest semver bump (BREAKING → MAJOR, FEAT → MINOR, others → PATCH)
- prepend a new `## [vX.Y.Z] — YYYY-MM-DD` block to `CHANGELOG.md`
- delete the consumed fragments
