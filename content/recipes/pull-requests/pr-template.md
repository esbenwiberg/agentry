# Recipe — Pull request authoring

A tool-agnostic prompt recipe for opening a clear, structured PR. Any AI
coding agent (or human) can follow it.

## When to use

After commits land and the branch is ready for review.

## Steps

1. **Verify the branch:**

   ```bash
   git branch --show-current
   git status
   ```

   Don't open a PR from `main` / `master`. If no upstream, push with
   `-u` later.

2. **Survey the full branch** — read all commits, not just the latest:

   ```bash
   git log <base>..HEAD --oneline
   git diff <base>...HEAD --stat
   git diff <base>...HEAD
   ```

3. **Draft a title** in conventional-commit form:

   ```
   type(scope): brief subject
   ```

   - Imperative, lowercase first letter, no trailing period.
   - Under ~70 characters.
   - For single-commit branches, the commit subject usually works.

4. **Draft a body** with these sections (or the project template's
   equivalents):

   ```markdown
   ## What

   [One or two sentences — the headline.]

   ## Why

   [The motivation. Business value or constraint. Current vs desired.]

   ## How

   **Implementation:**
   - Key implementation points.

   **Approach / decisions:**
   - Why this approach. Trade-offs accepted.

   **Files of note:**
   - `path/to/file.ext` — what changed and why.

   ## Test plan

   - [ ] How the reviewer can verify this works.
   - [ ] Edge cases covered.
   - [ ] Status of automated tests.
   ```

   Add `## Migration` for breaking changes; `## Screenshots` for UI
   changes; `## Risks` when post-merge risk warrants it.

5. **Honour the repo's PR template.** If `.github/pull_request_template.md`
   exists, fill in *its* sections, not yours.

6. **Present** the title and body to the user. Do not open until they
   approve.

7. **Push and create:**

   ```bash
   git push -u origin <branch>
   gh pr create --title "..." --body "..."
   ```

   For other hosts, use the host CLI (`glab mr create`,
   `az repos pr create`, ...).

8. **Surface the URL** the host returns.

## Done when

- The PR exists and the URL is visible to the user.
- Title, body, and target branch all match the user's intent.

## The body must answer

A reviewer who has not seen the diff should be able to learn:

- **What** — the headline change.
- **Why** — the motivation.
- **How** — the approach, and why this approach.
- **Risk** — what could break, what wasn't tested, what to watch.

If any are missing, the body is incomplete.

## Don't

- Open a PR from `main` / `master`.
- Paste `git log` as the body.
- Use generic titles like "minor changes" or "cleanup".
- Skip the test plan, even when "verified locally" is the answer.
- Open without explicit user approval of title + body.
