# Recipe — Repo git hooks via `core.hooksPath`

A tool-agnostic prompt recipe. Any AI coding agent (or human) can follow
it. Pair with the project's `.githooks/` plumbing.

## When to use

After cloning the repo, or after the maintainer adds new hooks under
`.githooks/`. Hooks under `.git/hooks/` are local-only and aren't
shared — repo-tracked hooks live under `.githooks/` and are activated by
pointing `core.hooksPath` at that directory.

## What this entry installs

- `.githooks/pre-commit` — runs cheap checks (secret scan via gitleaks).
- `.githooks/lib/secret-checks.sh` — gitleaks helper (warns if missing).
- `.githooks/install-hooks.sh` — sets `core.hooksPath` to the absolute
  `.githooks/` path so it works in worktrees too.
- `.githooks/commit-msg` — installed separately by the `commits` entry.

## Steps

1. **Run the installer once per clone:**

   ```bash
   bash .githooks/install-hooks.sh
   ```

   This sets `core.hooksPath` and `chmod +x`'s every hook script.

2. **Verify:**

   ```bash
   git config --get core.hooksPath
   # → /absolute/path/to/<repo>/.githooks
   ```

3. **Optional — install gitleaks** for the secret scan to do anything:

   ```bash
   brew install gitleaks
   # or see https://github.com/gitleaks/gitleaks
   ```

   If gitleaks isn't installed the pre-commit hook prints a warning and
   continues. Don't bypass with `--no-verify`.

## Done when

- `git config --get core.hooksPath` prints the repo's `.githooks/` dir.
- `ls -l .githooks/pre-commit` shows `-rwxr-xr-x` (executable bit set).
- A no-op commit succeeds and prints the `── pre-commit ──` banner.

## Notes

- `core.hooksPath` is per-clone, not per-repo — every contributor must
  run `install-hooks.sh` once after cloning. Add it to your project's
  README onboarding section.
- Hooks chain: if other entries (e.g., `commits`) install additional
  hooks under `.githooks/`, they all run from the same directory.
