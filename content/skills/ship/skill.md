# Ship Workflow

Orchestrator that runs **commit → review → pull request** end-to-end. A
single entrypoint when a unit of work is done and ready to land.

## When to use

- A feature, fix, or refactor is complete and tested locally.
- The branch is ready to leave your machine.
- You want one prompt that does the whole tail: commit, sanity-check,
  open a PR.

Don't use `ship` mid-work — finish the implementation first.

## Workflow

```
1. Pre-flight  →  2. Commit  →  3. Review  →  4. PR  →  5. Verify
```

## Steps

### 1. Pre-flight

Confirm the working state is shippable:

```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
```

Refuse to ship from `main`/`master`/`develop` — bail and ask the user
to switch to a topic branch. Refuse if the working tree contains
unrelated WIP that wasn't part of the unit of work.

### 2. Commit

Delegate to the `commits` skill:

- Group changes into logical commits.
- Classify each.
- Create fragments for fragment-required types.
- Present the plan, get approval.
- Stage and commit.

See [`../commits/skill.md`](../commits/skill.md). Don't reimplement the
classification logic here — call into the skill.

### 3. Review

Delegate to the `code-review` skill:

- Diff against the merge base of the topic branch.
- Produce a prioritised review (Critical / High / Medium / Low).
- End with a verdict line.

See [`../code-review/skill.md`](../code-review/skill.md).

If the review surfaces a **Critical** finding, stop and ask the user
whether to fix-and-recommit or proceed anyway. Don't silently swallow
critical findings.

### 4. Pull request

Delegate to the `pull-requests` skill:

- Push the branch (with `-u` if needed).
- Open a PR with What / Why / How + Test plan.
- Conventional-commit-shaped title.

See [`../pull-requests/skill.md`](../pull-requests/skill.md).

### 5. Verify

Print a final summary:

- Branch name and commit count.
- PR URL.
- Outstanding review findings (if user chose to defer).

## Anti-patterns

- ❌ Calling `ship` on `main` to "just push a quick fix".
- ❌ Skipping the review step because "it's a small change".
- ❌ Auto-merging the PR as part of `ship` — landing the PR is a human
  decision and may need CI to be green first.
- ❌ Squashing all of `ship` into one mega-prompt that bypasses the
  per-step approval gates of each underlying skill.

## Spec

Full rules: [`rules.md`](rules.md).
