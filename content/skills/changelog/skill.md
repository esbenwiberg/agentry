# Changelog Fragment Management

Create and validate changelog fragments under `.changes/`.

## When to use

- Before committing a change of type `feat`, `fix`, `refactor`, `perf`,
  `breaking`, `security`, or `build`.
- When the user asks for a changelog entry (`/changelog`).
- When validating that a fragment file is well-formed.

## Why fragments

`CHANGELOG.md` is **generated** at release time by merging all fragments
in `.changes/`. This means:

- No merge conflicts on the changelog file (each PR adds a new file).
- Each fragment is reviewable in isolation as part of its PR.
- A `commit-msg` hook can mechanically enforce that fragment-required
  commit types ship a fragment.

**Never edit `CHANGELOG.md` directly.** Add a fragment.

## Fragment file format

```
.changes/<descriptive-name>.<type>.md
```

- `descriptive-name` — kebab-case (`add-user-auth`, `fix-cache-race`).
- `type` — one of: `feat`, `fix`, `breaking`, `perf`, `security`,
  `refactor`, `build`. Must match the corresponding commit type.

Body:

```markdown
---
type: TYPE
scope: scope
---

One paragraph describing the change.
```

Frontmatter `type` is **uppercase** (`FEAT`, `FIX`, `BREAKING`, ...) even
though the filename suffix and commit type are lowercase.

## Steps

### 1. Decide whether you need a fragment

| Commit type | Fragment? |
|---|---|
| `feat`, `fix`, `refactor`, `perf`, `breaking`, `security`, `build` | yes |
| `test`, `docs`, `style`, `ci`, `chore`, `merge`, `revert` | no |

### 2. Pick a name and scope

- **Name:** kebab-case, descriptive. `add-X`, `fix-X`, `improve-X`,
  `redesign-X`. Avoid `update`, `change`, `feature1` — they tell the
  release reader nothing.
- **Scope:** kebab-case, the same scope you'll use in the commit subject.
  Match the directory/subsystem affected (`api`, `cli`, `parser`, `auth`).

### 3. Create the fragment

```bash
_scripts/changelog/create-fragment.sh \
  -t feat \
  -s api \
  -n add-user-auth \
  -d "Add user authentication endpoint with JWT support."
```

Or write the file by hand at `.changes/add-user-auth.feat.md`:

```markdown
---
type: FEAT
scope: api
---

Add user authentication endpoint with JWT support.
```

### 4. Stage with the code

```bash
git add src/auth/login.ts .changes/add-user-auth.feat.md
git commit -m "feat(api): add user authentication endpoint"
```

The fragment must be in the **same commit** as the code it describes.

### 5. Verify

```bash
ls -1 .changes/
cat .changes/add-user-auth.feat.md
```

The `commit-msg` hook checks:

- Filename matches `.changes/.*\.(feat|fix|breaking|perf|security|refactor|build)\.md`.
- A fragment is staged when the commit type requires one.

## Description guidance

**Good:**

- "Add user authentication endpoint with JWT support."
- "Resolve race condition in cache invalidation under concurrent load."
- "Reduce settings catalog generation time from 12s to under 2s."

**Bad:**

- "Added stuff."
- "Fix bug."
- "Update."

Write for the **release notes reader** — someone who hasn't seen the diff
and needs to know whether this affects them.

## Anti-patterns

- ❌ Editing `CHANGELOG.md` directly.
- ❌ One fragment for many unrelated changes.
- ❌ `feature1.feat.md`, `update.fix.md`, etc.
- ❌ Skipping the fragment with `--no-verify`.
- ❌ Creating a fragment for a `chore`/`test`/`docs` commit.

## Spec

Full rules: [`rules.md`](rules.md).
