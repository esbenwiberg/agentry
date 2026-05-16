# @example/repofit-corpus-ruby

Example third-party corpus package that shows how external packages can extend
repofit. It shadows the default `lint.clean` probe with a Ruby-aware version
and adds `rspec.clean`.

## Work here

- Keep the implementation in `src/index.ts`; this example is intentionally
  compact so users can read the whole corpus contract in one file.
- Preserve the visible override behavior documented in `README.md`.
- Treat `@esbenwiberg/repofit` as a peer dependency. Do not add runtime
  coupling to monorepo internals outside the public SDK.

## Checks

From the repo root:

```bash
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present
```

For changes that affect package metadata or examples, also run:

```bash
npm run build
```
