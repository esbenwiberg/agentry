# Commit Rules

The full spec for conventional commits in repos using `agentry`. The
`commit-msg` git hook enforces a subset of these mechanically; the rest
are conventions for humans and agents.

## Format

```
type(scope): subject

body (optional, blank line before)

footer (optional, blank line before)
```

## Types

| Type | Description | Fragment | Bump |
|---|---|---|---|
| `feat` | New user-facing capability | yes | MINOR |
| `fix` | Bug fix in shipped behaviour | yes | PATCH |
| `refactor` | Internal restructuring | yes | tracked |
| `perf` | Measurable performance improvement | yes | PATCH |
| `breaking` | Backwards-incompatible change | yes | MAJOR |
| `security` | Security fix | yes | PATCH |
| `build` | Build system or dependency | yes | tracked |
| `test` | Test-only change | no | — |
| `docs` | Docs / README / comments | no | — |
| `style` | Formatting only | no | — |
| `ci` | CI / pipeline config | no | — |
| `chore` | Tooling, dotfiles, non-runtime config | no | — |
| `merge` | Merge commit | no | — |
| `revert` | Revert a previous commit | no | — |

### When to use `chore`

Use `chore` for changes that **don't affect what users ship**:

- Dotfile directories: `.github/`, `.githooks/`, `.vscode/`, `.claude/`, `.editorconfig`.
- Developer tooling: `_scripts/`, lint config, formatter config.
- Editor / IDE settings.
- Agent harness config (not the code the agent edits).

**Don't use `chore` for** anything in `src/`, library code, or runtime
configuration that affects behaviour.

## Subject rules

1. Imperative mood. "add" not "added", "fix" not "fixed".
2. Lowercase first letter (the prefix `type` is already lowercase).
3. No period at the end.
4. Max 72 characters preferred; the hook allows up to 100.
5. Specific. "update files" or "WIP" are not subjects.

## Scope

A single token, lowercase, kebab-case if multi-word. Use the most specific
scope that's still meaningful in the project — typically a directory or a
subsystem name.

```
feat(auth): ...
fix(parser): ...
refactor(catalog): ...
```

Scope is optional in the format spec but **strongly preferred** — it makes
log scanning and changelog grouping vastly easier.

## Body

Wrap at ~72 columns. Explain the *why*, not the *what* — the diff already
shows the what. If the change has non-obvious consequences, document them
here.

## Footer

For breaking changes:

```
BREAKING CHANGE: <description of what broke and how to migrate>
```

For issue references (use what your tracker supports):

```
Closes #123
Refs PROJ-456
```

## Changelog fragments

Required for: `feat`, `fix`, `refactor`, `perf`, `breaking`, `security`,
`build`.
Skipped for: `test`, `docs`, `style`, `ci`, `chore`, `merge`, `revert`.

Fragment file at `.changes/<name>.<type>.md`. See the [changelog skill]
(../changelog/skill.md) for details. The `commit-msg` hook rejects
fragment-required commits without a staged fragment.

## Hook bypass policy

**Never use `--no-verify`** to bypass the commit-msg or pre-commit hook.
If a hook is wrong, fix the hook in a `fix(hooks): ...` commit. If the
fragment is genuinely not warranted, file a `chore` instead — but think
twice before reclassifying away from `feat`/`fix` just to dodge a fragment.

## Examples

Good:

```
feat(auth): add JWT-based login endpoint
fix(parser): handle trailing comma in JSON object
refactor(catalog): extract entry validation into helper
docs(readme): clarify lazy install posture
chore(githooks): bump gitleaks version pin
breaking(api): rename /v1/users to /v2/users
```

Bad:

```
WIP
Added stuff
fix bug
Update files.
feat: Add Feature.   ← capital A, trailing period
```

## Multi-commit workflow

When changes split into multiple commits:

1. **Inspect** with `git status` / `git diff`.
2. **Plan** — group into logical commits, classify each.
3. **Present** the plan and rationale to the user.
4. **Approve** — wait for explicit consent.
5. **Fragment** — create fragments for fragment-required commits.
6. **Stage and commit** each group.
7. **Verify** — confirm all commits landed.

Don't pre-commit half the work and ask later.

## Hooks

- `commit-msg` — validates the subject pattern and enforces fragments. See `.githooks/commit-msg`.
- `pre-commit` — runs cheap checks (e.g., secret scan via gitleaks). See `.githooks/pre-commit`.

Install with `bash .githooks/install-hooks.sh`.
