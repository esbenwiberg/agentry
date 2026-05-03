# Pull Request Rules

Authoring rules for PRs in repos using `agentry`.

## Title

Conventional-commit form:

```
type(scope): subject
```

- Imperative, lowercase first letter, no trailing period.
- Max ~70 characters — list views truncate the rest.
- Don't put detail in the title; that's what the body is for.

Examples:

```
feat(api): add user authentication endpoint
fix(parser): handle trailing comma in JSON object
refactor(catalog): extract entry validation
breaking(api): rename /v1/users to /v2/users
```

## Body structure

Default sections (use these unless the repo has a stricter template):

```markdown
## What

[One or two sentences — the headline.]

## Why

[The problem or motivation. Business value or constraint that drove
this. Current vs desired state.]

## How

**Implementation:**
- Key implementation points.

**Approach / decisions:**
- Why this approach. Any trade-offs accepted.

**Files of note:**
- `path/to/file.ext` — what changed and why.

## Test plan

- [ ] How the reviewer can verify this works.
- [ ] Edge cases covered.
- [ ] Status of automated tests.
```

Optional sections (add when relevant):

- `## Screenshots / Examples` — UI changes, request/response samples.
- `## Migration` — for `breaking` PRs, the steps consumers must take.
- `## Risks` — what could go wrong post-merge, and how to roll back.

## Repo template precedence

If the repo has `.github/pull_request_template.md`, **use it as-is**.
Map our default sections onto the template's sections rather than
inventing your own. The template is policy.

## Branch naming

Match the repo's convention. If unspecified, default:

- From `main` / default branch → `feature/<topic>`.
- From a release branch → `hotfix/<topic>`.
- From an experiment / spike → `spike/<topic>`.

Kebab-case, descriptive, no generic names (`fix`, `update`).

## Commit hygiene before opening

- All commits follow conventional format (the `commit-msg` hook enforces
  this for repos using `agentry`'s hooks).
- Required changelog fragments are present in `.changes/`.
- The branch builds locally — don't outsource basic verification.
- Squashing is a project-policy choice, not a default. Don't squash
  without asking if the project history shows non-squashed PRs.

## What the body must answer

A reviewer who has not seen the diff should be able to learn:

1. **What** — the headline change, in one sentence.
2. **Why** — the motivation. Without this, the diff is just text.
3. **Approach** — *how* the change is structured, and *why this way*.
4. **Risk** — what could break, what didn't get tested, what to watch.

A body that fails any of these is incomplete. Add the missing piece
before opening.

## Don't

- ❌ Open a PR from `main` / `master`.
- ❌ Paste `git log --oneline` as the body.
- ❌ Use "minor changes" or "cleanup" as the title.
- ❌ Skip the Test plan, even when "I tested it locally" is the answer.
- ❌ Open without explicit user approval of title + body.

## Spec home

This file. The skill (`skill.md`) is the operational walkthrough; this
is the contract.
