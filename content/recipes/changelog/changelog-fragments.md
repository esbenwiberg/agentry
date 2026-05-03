# Recipe — Changelog fragments

A tool-agnostic prompt recipe for adding a changelog entry without
editing `CHANGELOG.md` directly. Pair with `.changes/` and the project's
release pipeline.

## When to use

Before committing any change of type `feat`, `fix`, `refactor`, `perf`,
`breaking`, `security`, or `build`.

## Steps

1. **Confirm a fragment is needed.** These commit types require one:
   `feat`, `fix`, `refactor`, `perf`, `breaking`, `security`, `build`.
   Skip for: `test`, `docs`, `style`, `ci`, `chore`, `merge`, `revert`.

2. **Pick a name and scope:**
   - **Name** — kebab-case, descriptive. Prefix with the change shape
     (`add-X`, `fix-X`, `improve-X`, `redesign-X`). Avoid `update`,
     `change`, `feature1`.
   - **Scope** — kebab-case, the same scope you'll use in the commit
     subject. The most specific subsystem name that's still meaningful.

3. **Create the file** at `.changes/<name>.<type>.md`:

   ```markdown
   ---
   type: TYPE
   scope: scope
   ---

   One paragraph describing the change for the release-notes reader.
   ```

   Frontmatter `type` is **uppercase** (`FEAT`, `FIX`, `BREAKING`, ...).

   If the project ships a creator script, use it:

   ```bash
   _scripts/changelog/create-fragment.sh -t feat -s api -n add-user-auth \
     -d "Add user authentication endpoint with JWT support."
   ```

4. **Write for someone who hasn't seen the diff.** Answer:
   - Does this affect me?
   - Do I need to migrate or update?
   - Where do I learn more?

   For breaking changes, name the migration path or link to one.

5. **Stage with the code:**

   ```bash
   git add <files> .changes/<name>.<type>.md
   ```

   The fragment must be in the **same commit** as the code it describes.

## Done when

- A fragment file exists with valid frontmatter and a useful description.
- The fragment is staged together with the code change.
- `commit-msg` accepts the commit (or, if no hook, the format spec is met).

## Don't

- Don't edit `CHANGELOG.md` directly. It's generated from fragments at
  release time.
- Don't combine unrelated changes in one fragment.
- Don't use generic names like `update.feat.md`.
