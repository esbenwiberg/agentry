# PRACTICES

How to contribute to `agentry`. This file is the conventions doc — separate
from `CLAUDE.md` (which is project context) and `README.md` (which is for
users of the CLI).

## Posture

- **Scan-driven.** `scan` + `brief` is the top of funnel — deterministic
  evidence, then handoff to the user's coding agent. `add` / `upgrade` /
  `remove` cover overlay artifacts; `coach` is bespoke authoring without
  the full loop. `doctor` is gone — drift check is `upgrade --check`.
  See ADR-0005.
- **Bundled catalog ships practices, not artifacts.** Markdown guidance
  only. Anything byte-perfect lives in an overlay a team owns. Reviewers
  enforce "practice docs only" on bundled catalog PRs.
- **Most readiness can't be installed.** The agent authors per-repo
  files (CLAUDE.md, ADRs, specs) using practices as guidance. `agentry`
  collects evidence and verifies via re-scan; it does not write prose.
- **Tool-agnostic.** Practice docs must read for *any* AI coding agent.
  If something only makes sense with Claude Code, gate it behind a
  `claude` flavor on the relevant catalog provide.
- **Lazy install.** No giant `init` blast. `add` is conflict-aware on
  every collision — keep / take-ours / diff / skip.

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
_scripts/changelog/create-fragment.sh -t feat -s scan -n add-scan-verb -d "Initial scan implementation"
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

- Don't ship installable artifacts in the bundled catalog. Practices
  only. Byte-perfect things go in an overlay.
- Don't ship Claude-only behavior in bundled practices — push it to
  Claude-flagged content (`flavor = "claude"` on the relevant provide).
- Don't add a workspace / monorepo layout. One package, one `package.json`.
- Don't add a config file format until at least three users ask for one.
