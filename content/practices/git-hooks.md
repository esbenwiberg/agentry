# Git hooks — practice

A reference for choosing a hook strategy and writing hooks that don't get
ripped out the first time CI complains.

## When to use

- The repo has no enforced pre-commit / commit-msg checks and you want to
  start.
- An existing setup fights contributors (slow, flaky, opaque).
- A team-wide standard exists (overlay) and you're applying it to a new
  repo.

## Three strategies, three trade-offs

| | Speed | Cross-platform | Vendor lock-in | Setup |
|---|---|---|---|---|
| `core.hooksPath` (raw `.githooks/`) | Fastest | Posix-friendly; Windows needs Bash | None | One install script |
| **husky** | Fast | Cross-platform via npm | Tied to JS toolchain | `npx husky install` |
| **lefthook** | Fastest (parallel) | Cross-platform binary | Single tool to install | YAML config |
| **pre-commit** (Python) | Slower (per-hook env) | Cross-platform via Python | Python required | `pre-commit install` |

Pick by team shape, not novelty:

- All-JS shop already running npm → **husky** (zero new tools).
- Polyglot team that ships binaries → **lefthook** (parallel, no runtime).
- Already on Python tooling (data, ML) → **pre-commit** (community
  hooks).
- Tooling allergy / minimal repo → **`core.hooksPath`** (it's just bash).

## What good looks like

1. **Hooks are fast.** Pre-commit budget: ~2s for a typical commit.
   Slow hooks get bypassed (`--no-verify`) and never recover.
2. **Hooks are diagnosable.** When a hook fails, the message tells the
   developer what to do next (run `npm run lint:fix`, not just "lint
   failed").
3. **Hooks are scoped.** Run on staged files only (`lint-staged`,
   `lefthook --files`), not the whole tree.
4. **Hooks are reproducible in CI.** What the hook checks locally, CI
   re-checks. The hook is a fast pre-commit; CI is the gate.
5. **One installer step.** Cloning the repo and running `npm install` /
   `pnpm install` / `bash .githooks/install-hooks.sh` activates hooks.
   No README scavenger hunt.

## Common hooks worth writing

- `commit-msg` — enforce a structured commit format. Use the team's
  exact regex (overlay) when one exists; otherwise see `commits` for
  guidance.
- `pre-commit` — secret scan (gitleaks / detect-secrets / trufflehog),
  staged-file lint, format check.
- `pre-push` — type check, full test suite (only if fast).

## What to avoid

- Hooks that mutate working tree without prompting (auto-formatting on
  commit). Use a `--check` mode and ask the dev to re-stage.
- Hooks that depend on tools that aren't enforced as installed (warn,
  don't block).
- "All hooks all the time" — start with one or two and add as the team
  reaches for `--no-verify`.

## Authoring a tailored hook setup

Use the practice above as the rubric. The repo's stack
(`structure/manifests.json`) and existing hooks
(`agent-readiness/report.json`, `hygiene/checklist.json`) determine which
strategy fits. Write a minimal hook script the team will actually keep.
If a team-canonical `commit-msg` regex exists in an overlay, install it
verbatim via `agentry add <overlay-id>` — don't reinvent it per repo.
