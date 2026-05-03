# Recipe — Conventional commits with changelog fragments

A tool-agnostic prompt recipe. Any AI coding agent (or human) can follow
it. Pair with the project's `.changes/` and `.githooks/` plumbing.

## When to use

After making changes that need to land as one or more commits.

## Steps

1. **Inspect** the working tree:
   - Run `git status --porcelain` and `git diff --stat`.
   - Note files, directories, and apparent logical clusters.

2. **Group** changes into logical commits. One commit = one logical
   change. Split when rationale differs (a fix and a refactor); combine
   when files are co-changed for the same intent.

3. **Classify** each group with a conventional commit type:

   - `feat` — new user-facing capability
   - `fix` — bug fix in shipped behaviour
   - `refactor` — internal restructuring, no behaviour change
   - `perf` — measurable performance improvement
   - `breaking` — backwards-incompatible change
   - `security` — security fix
   - `build` — build system / dependency change
   - `test` — test-only change
   - `docs` — documentation only
   - `style` — formatting only
   - `ci` — CI configuration
   - `chore` — tooling / dotfiles / non-runtime config

4. **Format** each commit subject:

   ```
   type(scope): subject
   ```

   - Imperative ("add" not "added").
   - Lowercase first letter.
   - No trailing period.
   - Max ~72 chars.
   - Scope optional but strongly preferred (e.g., `api`, `cli`, `parser`).

5. **Create a changelog fragment** for each commit of type `feat`, `fix`,
   `refactor`, `perf`, `breaking`, `security`, or `build`:

   ```
   .changes/<kebab-name>.<type>.md
   ```

   ```markdown
   ---
   type: TYPE
   scope: scope
   ---

   One-paragraph description for the release-notes reader.
   ```

   Frontmatter `type` is uppercase. Skip fragments for `test`, `docs`,
   `style`, `ci`, `chore`.

6. **Present the plan** — show the user the commit list, file groupings,
   and fragment descriptions. Wait for explicit approval.

7. **Stage and commit** each group, including its fragment file:

   ```bash
   git add <files> .changes/<name>.<type>.md
   git commit -m "type(scope): subject"
   ```

8. **Honour hooks.** If `commit-msg` rejects, read the message and fix.
   Don't bypass with `--no-verify`.

## Done when

- All intended changes are committed.
- Each fragment-required commit ships with a fragment.
- The user has seen and approved the plan.

## Notes for non-Claude agents

- This recipe assumes the project uses fragment-based changelogs at
  `.changes/`. If the project doesn't, skip step 5 — but still classify
  commits correctly.
- The hook bypass policy (`--no-verify` is forbidden) is project policy,
  not a tool feature. Respect it.
