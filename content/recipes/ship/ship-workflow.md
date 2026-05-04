# Recipe — Ship workflow (commit → review → PR)

A tool-agnostic prompt recipe. Any AI coding agent (or human) can follow
it. Pair with the project's `commits`, `code-review`, and
`pull-requests` recipes.

## When to use

A unit of work is finished and ready to leave the machine.

## Pre-flight

1. Confirm a git repo: `git rev-parse --git-dir`.
2. Confirm the current branch is not the default branch:

   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

   If it's `main` / `master` / `develop`, **stop**. Ask the user to
   switch to a topic branch.

3. Note the merge base for review and PR scope:

   ```bash
   git merge-base HEAD origin/main   # or origin/master
   ```

## Steps

1. **Commit.** Follow the conventional-commits recipe. Group, classify,
   fragment, present the plan, wait for approval, then commit.

2. **Review.** Follow the structured-review recipe against the merge
   base. Produce a prioritised list (Critical / High / Medium / Low)
   and a verdict line.

3. **Critical gate.** If the review found Critical issues:
   - Show them to the user.
   - Ask: fix-and-recommit, or proceed to PR with findings noted.
   - Don't silently proceed.

4. **Pull request.** Follow the pull-request recipe. Push the branch
   (`-u` if needed), open the PR with What / Why / How + Test plan.

5. **Summary.** Print branch name, commit count, PR URL, review verdict,
   and any deferred findings.

## Done when

- The branch has the intended commits.
- The PR is open with a complete body.
- The user has seen the review verdict and any deferred findings.

## Refusals

The recipe refuses to:

- Run on the default branch.
- Auto-merge the PR.
- Skip any step's approval gate.

## Notes for non-Claude agents

- This recipe is purely an orchestrator. It assumes the underlying
  recipes (commits, code-review, pull-requests) exist in the project.
  If any are missing, fall back to a manual prompt for that step rather
  than skipping it.
