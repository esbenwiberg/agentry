# Commit Workflow

Structured commit workflow with conventional commits and changelog fragments.

## When to use

- After completing a unit of work that's ready to commit.
- Before opening a pull request.
- When you have multiple unrelated changes staged and need to split them.

## Workflow

```
1. Inspect changes  →  2. Group + classify  →  3. Suggest plan  →
4. Create fragments  →  5. Stage + commit  →  6. Offer review/PR
```

## Steps

### 1. Inspect changes

```bash
git status --porcelain
git diff --stat
git diff               # for the smaller hunks
```

Note the file types, the directories touched, and any logical clusters.

### 2. Group changes into commits

A good commit is **one logical change**. Split when:

- Two changes have unrelated rationale (a bug fix and a refactor).
- One change is `feat`/`fix` and another is `chore`/`docs`/`test`.
- Reverting one would not affect the other.

Combine when:

- Files are co-changed for the same feature (handler + test + caller).
- Splitting would make either commit non-buildable.

### 3. Classify each commit

| Type | Use for | Fragment? |
|---|---|---|
| `feat` | New user-facing capability | yes |
| `fix` | Bug fix in shipped behaviour | yes |
| `refactor` | Internal restructuring, no behaviour change | yes |
| `perf` | Measurable performance improvement | yes |
| `breaking` | Backwards-incompatible change | yes |
| `security` | Security fix | yes |
| `build` | Build system / dependency change | yes |
| `test` | Test-only change | no |
| `docs` | Docs / README / comments only | no |
| `style` | Formatting only | no |
| `ci` | CI/CD config | no |
| `chore` | Tooling, dotfiles, configs that don't affect runtime | no |

**Heuristic for `chore`:** if the change is in `.github/`, `.githooks/`,
editor config, or developer tooling and **does not** affect what users
ship, it's `chore`.

### 4. Present the plan

Before executing, show the user the planned commits:

```
Commit 1: feat(api): add user authentication endpoint
  Files:
    - src/auth/login.ts
    - src/auth/login.test.ts
    - .changes/add-user-auth.feat.md (will create)
  Fragment description: "Add user authentication endpoint with JWT support."

Commit 2: docs(readme): document new auth endpoint
  Files:
    - README.md
  No fragment (docs).
```

Ask: *Approve, modify, or split differently?* Don't proceed without consent.

### 5. Create changelog fragments (mandatory for fragment-required types)

For each `feat`/`fix`/`refactor`/`perf`/`breaking`/`security`/`build`
commit, create a fragment **before** committing and stage it with the
code:

```bash
_scripts/changelog/create-fragment.sh \
  -t feat \
  -s api \
  -n add-user-auth \
  -d "Add user authentication endpoint with JWT support."
```

Or manually create `.changes/<name>.<type>.md`:

```markdown
---
type: FEAT
scope: api
---

Add user authentication endpoint with JWT support.
```

The `commit-msg` hook rejects fragment-required commits without a fragment.
**Never use `--no-verify`** to bypass — fix the underlying gap.

### 6. Execute

```bash
git add src/auth/login.ts src/auth/login.test.ts .changes/add-user-auth.feat.md
git commit -m "feat(api): add user authentication endpoint"
```

If the hook rejects, read the message — usually it's a missing fragment or
a malformed subject. Fix and re-stage. Don't `--no-verify` and don't
`--amend` if a hook failure could mean the commit didn't happen.

### 7. Offer review and PR

After commits succeed, offer the user:

- A structured code review (see `code-review` skill).
- A pull request (see `pull-requests` skill).
- Or stop here.

## Subject rules

- Imperative mood: "add feature", not "added feature".
- Lowercase first letter (after the type prefix).
- No trailing period.
- Max ~72 chars (the hook allows up to 100).
- Specific. "fix bug" is not a commit subject.

## Breaking changes

Add `BREAKING CHANGE:` to the commit body and ship a `.breaking.md`
fragment:

```
breaking(api): redesign auth flow

BREAKING CHANGE: POST /auth moved to POST /api/v2/auth.
Body changed from {user, pass} to {username, password}.
```

## Anti-patterns

- ❌ Commits with >10 files unless they truly belong together.
- ❌ Mixed feat + fix + refactor in one commit.
- ❌ "WIP", "changes", "updates" as subjects.
- ❌ Bypassing hooks with `--no-verify`.

## Spec

Full rules: [`rules.md`](rules.md).
