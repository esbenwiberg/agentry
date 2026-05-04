# PRACTICES

How to contribute to `agentry`. This file is the conventions doc — separate
from `CLAUDE.md` (which is project context) and `README.md` (which is for
users of the CLI).

## Posture

- **Three verbs only.** `doctor`, `add`, `coach`. No `init`, no `upgrade`,
  no plugin runtime, no daemon. If a feature doesn't fit a verb, it's
  probably the wrong feature.
- **Most readiness can't be installed.** Default to `coach` (interactive
  authoring) before `add` (drop-in template). Never write a fake nested
  `CLAUDE.md` for someone — make them author it.
- **Tool-agnostic.** Skills + recipes must read for *any* AI coding agent,
  not just Claude. If something only makes sense with Claude Code, gate it
  behind a `claude` flag in the catalog manifest.
- **Lazy install.** No giant `init` blast. Adopters pull in only what they
  ask for. `add` is conflict-aware — keep / take-ours / diff / skip on every
  collision.

## Commits

`type(scope): subject` — imperative, lowercase, no period, max 100 chars.

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `merge`, `revert`, `breaking`.

The `commit-msg` hook enforces this. **Never use `--no-verify`** to bypass
it — fix the underlying issue. If the hook itself is wrong, that's a
`fix(hooks):` commit.

## Changelog fragments

**Required** for: `feat`, `fix`, `refactor`, `perf`, `build`, `breaking`,
`security`.
**Skip** for: `test`, `docs`, `style`, `ci`, `chore`.

Create with:

```bash
_scripts/changelog/create-fragment.sh -t feat -s cli -n add-doctor-verb -d "Initial doctor implementation"
```

Format spec: `.changes/README.md`. **Never edit `CHANGELOG.md` directly** —
it's generated from fragments.

## Pull requests

Title in conventional-commit form. Body uses `## What`, `## Why`, `## How`.

```bash
gh pr create --head <branch>
```

## ADRs

`docs/adr/` for **locked** architectural decisions (numbered, sequential).
`docs/decisions/` for design notes still being argued over (unnumbered,
free-form). When something graduates from `decisions/` to `adr/`, link the
old draft and delete it.

Status field on every ADR: `Proposed | Accepted | Deprecated | Superseded by ADR-XXXX`.

## TypeScript style

- Strict mode, ESM, `NodeNext`. No CommonJS.
- No `any` unless explicitly justified in a comment.
- Prefer `readonly` on data structures.
- Errors are values where it makes sense (Result types) — but `throw` is
  fine for top-level CLI errors that translate to non-zero exit.
- File naming: `kebab-case.ts`. One default export per CLI command file.

## Testing

`vitest` is the runner. `npm test` builds via `pretest` and runs the
suite against `dist/`. Tests live under `tests/` — verb contract tests
at the top level (each verb is one file) and unit tests under
`tests/unit/`. Real tmpdirs, no `fs` mocks. Conventions and design
choices live in [`specs/test-suite/`](specs/test-suite/).

## Don't

- Don't add features outside the three-verb model.
- Don't ship Claude-only behavior in the kernel skills/recipes — push it to
  Claude-flagged content.
- Don't add a workspace / monorepo layout. One package, one `package.json`.
- Don't add a config file format until at least three users ask for one.
