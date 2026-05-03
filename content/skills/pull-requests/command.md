---
description: Open a pull request with a structured description
---

You are opening a pull request for the current branch.

Task: $ARGUMENTS

## Instructions

Read and follow [`.claude/skills/pull-requests/skill.md`](../skills/pull-requests/skill.md).

The workflow covers:

- Verifying the branch, base, and upstream state.
- Surveying *all* commits in the branch (not just the latest).
- Drafting a conventional-commit title.
- Drafting a What / Why / How body with a Test plan.
- Presenting the proposal to the user before pushing.
- Pushing and creating the PR (`gh pr create` on GitHub, equivalent
  elsewhere).
- Surfacing the PR URL on success.

Full spec: [`.claude/skills/pull-requests/rules.md`](../skills/pull-requests/rules.md).
