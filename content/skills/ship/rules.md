# Ship Rules

The full spec for the `ship` orchestrator. `ship` chains three other
skills (`commits`, `code-review`, `pull-requests`); the rules here cover
orchestration only — the per-step rules live in the sub-skill specs.

## Pre-flight

Before running any sub-step:

- The working tree must be inside a git repo.
- The current branch must **not** be `main`, `master`, or `develop`. If
  it is, abort with a clear message and don't make any commits.
- Note the merge base against the default branch — review and PR both
  use it.

## Step ordering

The order is fixed:

```
commits  →  code-review  →  pull-requests
```

- Don't open a PR before reviewing.
- Don't review before committing — there's nothing to review.
- If a step fails or the user declines to continue, stop. Don't skip
  ahead.

## Approval gates

Each sub-skill has its own approval gate (commit plan, review verdict,
PR body). `ship` does **not** collapse them into a single approval —
the user must approve each step explicitly.

## Critical-finding handling

If the code-review step produces a Critical finding:

1. Pause before opening the PR.
2. Show the finding to the user.
3. Ask: fix and re-commit, or proceed to PR with the finding noted in
   the PR body.

Don't open the PR silently with a Critical finding hidden.

## Refusals

`ship` refuses to:

- Run on `main` / `master` / `develop`.
- Run with no staged or committable changes.
- Auto-merge the PR (landing is a human decision).
- Bypass any sub-skill's approval gate.

## Output

After the PR opens, emit a summary block:

```
Branch:   <branch-name>
Commits:  <N> (since <merge-base>)
PR:       <url>
Review:   <verdict line>
Notes:    <deferred findings, if any>
```

Keep it terse — the PR URL is the artefact, the rest is context.

## Spec

Per-step rules:

- [`../commits/rules.md`](../commits/rules.md)
- [`../code-review/rules.md`](../code-review/rules.md)
- [`../pull-requests/rules.md`](../pull-requests/rules.md)
