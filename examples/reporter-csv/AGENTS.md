# @example/repofit-reporter-csv

Example third-party reporter package that demonstrates the public reporter
contract. It emits one CSV row per probe from the structured report object.

## Work here

- Keep the reporter implementation in `src/index.ts`; this example should stay
  small enough to copy into a real package.
- Preserve the `csv` reporter name because the README uses it in
  `repofit check --reporter csv=probes.csv`.
- Treat `@esbenwiberg/repofit` as a peer dependency and use only the public SDK.

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
