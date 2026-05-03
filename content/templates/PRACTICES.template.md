# PRACTICES

> Replace this with a one-line description of what this file is for.
> Example: *"How to contribute to <PROJECT_NAME>. Conventions for
> humans and AI agents alike."*

## Posture

> 2–4 bullets stating the project's product and process posture.
> Examples: "Stability over novelty." / "Small PRs, fast review."

- > *Example*
- > *Example*

## Commits

`type(scope): subject` — imperative, lowercase, no period, max 72 chars.

Valid types: `feat`, `fix`, `refactor`, `perf`, `breaking`, `security`,
`build`, `test`, `docs`, `style`, `ci`, `chore`, `merge`, `revert`.

The `commit-msg` hook enforces format and fragment requirements.
**Never use `--no-verify`** to bypass — fix the underlying issue.

Full spec: `.claude/skills/commits/rules.md`

## Changelog fragments

Required for: `feat`, `fix`, `refactor`, `perf`, `breaking`, `security`, `build`.
Skip for: `test`, `docs`, `style`, `ci`, `chore`.

Create with `_scripts/changelog/create-fragment.sh`. Spec:
`.claude/skills/changelog/rules.md`.

**Never edit `CHANGELOG.md` directly** — it's generated from fragments.

## Pull requests

Title: conventional-commit form. Body: `## What` / `## Why` / `## How` /
`## Test plan`.

```bash
gh pr create --head <branch>
```

## Code style

> Project-specific style rules. Lean on language defaults; only call out
> what overrides them.

- > *Example: "Prefer `async`/`await` over `.then()`."*
- > *Example: "TypeScript: no `any`. Use `unknown` and narrow."*
- > *Example: "Imports sorted by `eslint-plugin-simple-import-sort`."*

## Testing

> Framework, naming convention, coverage threshold.

- Framework: > *e.g., Vitest / NUnit / pytest*
- Naming: > *e.g., `<unit>_<scenario>_<expected>`*
- Coverage: > *e.g., 80% on changed files in `src/core`*

## Don't

> Three to five anti-patterns the team has explicitly rejected. Each
> one short, with a reason.

- > *Example: "Don't add a feature flag for backwards-compatibility — we
  > prefer one breaking change with a migration over a forever-flag."*
- > *Example: "Don't introduce a new dependency without an ADR."*
