# Commit

Use this skill when preparing a commit in this repository.

1. Check the working tree:

```bash
git status --short
```

2. Run focused verification for the files changed. For corpus changes, use:

```bash
npm --workspace @esbenwiberg/corpus-default run typecheck
npm --workspace @esbenwiberg/corpus-default test
```

For engine changes, use:

```bash
npm --workspace @esbenwiberg/repofit run typecheck
npm --workspace @esbenwiberg/repofit test
```

3. Always run:

```bash
npm run lint
```

4. Stage only intended files.
5. Commit using `type(scope): subject`, for example `feat(corpus): add test oracle probe`.

Guardrails:
- Do not use `--no-verify`.
- Do not stage unrelated user changes.
- If generated reports live under `/private/tmp`, do not commit them.
