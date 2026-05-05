# Pull Request Workflow

Open a pull request with a clear, structured description that helps the
reviewer pick up cold.

## When to use

- After commits land and the branch is ready for review.
- After a `/review` pass, if findings are addressed.
- When the user asks for `/pr`.

## Prerequisites

- A clean working tree (no uncommitted changes that should be in the PR).
- Branch pushed to the remote, or push as part of the workflow.
- `gh` (GitHub CLI) authenticated — or an equivalent command for the
  host (GitLab `glab`, Azure DevOps `az repos pr`, etc).

## Workflow

```
1. Verify branch  →  2. Survey commits + diff  →  3. Draft title + body  →
4. Present to user  →  5. Push + create PR  →  6. Show URL
```

## Steps

### 1. Verify the branch

```bash
git branch --show-current
git status
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null \
  || echo "(no upstream yet)"
```

- Don't open a PR from `main` / `master`.
- If there's no upstream, push with `-u` later.
- Branch naming: most projects use `feature/<topic>` from `main` and
  `hotfix/<topic>` from a `release/*` line. Match the project's
  convention if it has one; otherwise lean toward `feature/<topic>`.

### 2. Survey commits and full diff

```bash
git log <base>..HEAD --oneline
git diff <base>...HEAD --stat
git diff <base>...HEAD
```

Read **all commits**, not just the latest. The PR represents the whole
branch.

### 3. Draft title and body

**Title** — conventional-commit style:

```
type(scope): brief subject
```

Examples:

```
feat(api): add user authentication endpoint
fix(parser): handle trailing comma in JSON
refactor(catalog): extract entry validation
```

If the branch is a single commit, the commit subject often makes a fine
PR title. If multiple commits, summarise the *headline* change.

**Body** — `What` / `Why` / `How`:

```markdown
## What

[One or two sentences. The headline. Active voice.]

## Why

[The problem or need. Business value. Current vs desired state. Link to
issue/ticket if applicable.]

## How

**Implementation:**
- Key implementation points

**Approach / decisions:**
- Why this approach over alternatives
- Any trade-offs accepted

**Files of note:**
- `path/to/file.ext` — what changed and why

## Test plan

- [ ] How the reviewer (or you) can verify this works
- [ ] Edge cases covered
- [ ] Manual / automated test status
```

### 4. Present to the user

Show the proposed title + body. Ask for approval. Don't open the PR
unprompted — even after `/review` says approved.

```markdown
Suggested PR:

**Title:** feat(api): add user authentication endpoint

**Body:** [show full body]

OK to push and open the PR?
```

### 5. Push and create

```bash
git push -u origin <branch>

gh pr create \
  --title "feat(api): add user authentication endpoint" \
  --body "$(cat <<'EOF'
## What
...
EOF
)"
```

For non-GitHub hosts, swap `gh pr create` for the host's CLI:

- GitLab: `glab mr create --title ... --description ...`
- Azure DevOps: `az repos pr create --title ... --description "@body.md"`

### 6. Show the URL

After creation, surface the PR URL so the user can click into it.

## Title rules

- Conventional commit format: `type(scope): subject`.
- Imperative, lowercase first letter, no trailing period.
- Under ~70 characters — long titles get truncated in lists.
- Body carries detail; the title is the headline.

## Body anti-patterns

- ❌ "Closes #123" with no further description — the reviewer still
  needs to know what changed.
- ❌ Walls of bullet points with no narrative.
- ❌ Pasting the commit log as the body. Commits ≠ PR description.
- ❌ Skipping `Why` — the reviewer needs the motivation.
- ❌ Skipping `Test plan` — even one sentence ("verified locally with X")
  is better than nothing.

## When the PR template differs

Some repos enforce a `.github/pull_request_template.md`. Respect it:

- If a template exists, fill in the template's sections rather than
  inventing your own.
- If sections overlap (`## What` ≈ `## Summary`), use the template's
  section names.

## Spec

Full rules: [`rules.md`](rules.md).
