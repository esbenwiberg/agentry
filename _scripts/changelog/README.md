# Changelog scripts

Bash helpers for working with `.changes/` fragments.

## `create-fragment.sh`

Creates a new fragment file under `.changes/`.

```bash
_scripts/changelog/create-fragment.sh \
  -t feat \
  -s cli \
  -n add-doctor-verb \
  -d "Add agentry doctor — read-only 7-layer audit."
```

Validates type, kebab-case name + scope, refuses to overwrite. Writes the
file with proper YAML frontmatter.

## (Future) merge / version scripts

TeamPlanner has PowerShell helpers (`merge-fragments.ps1`, `get-version.ps1`)
that walk `.changes/`, compute the next semver, update `CHANGELOG.md`, and
delete consumed fragments. We will port the bits we need to bash when the
release pipeline lands. Until then, fragments accumulate and CI doesn't
fail on missing release tooling.
