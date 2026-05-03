# Core Rules (always loaded)

The minimum the agent must always know. Compressed; full specs are linked.

## Commits

Format: `type(scope): subject` — imperative, lowercase, no period, max 72 chars.

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`,
`ci`, `chore`, `breaking`, `security`, `merge`, `revert`.

Full spec: `.claude/skills/commits/rules.md`

## Changelog fragments

**Required** for: `feat`, `fix`, `refactor`, `perf`, `build`, `breaking`, `security`.
**Skip** for: `test`, `docs`, `style`, `ci`, `chore`.

Create with `_scripts/changelog/create-fragment.sh` (or the project's
equivalent helper). The `commit-msg` hook enforces this — **do NOT use
`--no-verify`** to bypass.

Full spec: `.claude/skills/changelog/rules.md`

## Pull requests

Title: conventional-commit form. Body: `## What` / `## Why` / `## How` /
`## Test plan`. Honour `.github/pull_request_template.md` if it exists.

Use `gh pr create --head <branch>` (or the host's equivalent CLI).

Full spec: `.claude/skills/pull-requests/rules.md`

## Quality gates

- Build must pass before commit.
- Pre-commit hooks run automatically (secret scan, format, lint).
- Project-specific coverage / lint thresholds apply when defined.

Full spec: `.claude/skills/code-review/rules.md` and project quality docs.

## Hook bypass policy

**Never** use `--no-verify` to bypass `commit-msg` or `pre-commit`.
If a hook is wrong, fix the hook in a `fix(hooks): ...` commit. If a
fragment is genuinely unwarranted, the commit is probably miscategorised.
