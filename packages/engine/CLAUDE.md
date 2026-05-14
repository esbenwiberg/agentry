# @esbenwiberg/repofit (engine)

The runtime + CLI. A repo gets passed through a pipeline:

```
loader → evidence gatherers → runner → scorer → aggregator → reporters
```

Each stage is a directory under `src/`. The SDK in `src/sdk/` is the **public
surface** — anything you change there is a breaking change for corpus authors.

## Layout

| Dir | Purpose |
|---|---|
| `cli/` | `repofit check`, `explain`, `apply`, `waive`, `probe`. Thin commander entrypoints; logic lives elsewhere. |
| `sdk/` | Public API exported as `@esbenwiberg/repofit/sdk`. `defineProbe`, `defineDimension`, recipes. **Don't break this without a major bump.** |
| `evidence/` | Subsystem registry + gatherers (files, gitignore, size-stats, node-package, ci-workflows, commit-history, judge, …). Gatherers run once per check, probes consume the cached evidence. |
| `loader/` | Reads `repofit.config.json`, resolves corpus packages, loads the baseline. |
| `runner/` | Tier scheduler. Runs `static` probes first, then `derived`, then `executed`/`reasoned`. |
| `scorer/` | Maps a `Reading` to a score (0–100) via the probe's `score` band. |
| `aggregator/` | Probe → dimension → fitness. Dimension weights live here. |
| `reporters/` | `human` (TTY), `json`, `ci` (compact summary line). |
| `verdict/` | Gate evaluation (ratchet, absolute, advisory). |
| `fixtures/` | Test harness for probe fixtures — corpus packages import `runFixture` from `@esbenwiberg/repofit/fixtures`. |
| `util/` | `exec`, `count-lines`, `error-message`. Keep this minimal — no business logic. |

## Build & test

```bash
npm run build       # from monorepo root, or `npm run build -w @esbenwiberg/repofit`
npm test            # vitest run
```

## Conventions

- **Strict TypeScript, ESM, NodeNext.** `import x from "./foo.js"` (with `.js`)
  even when the file is `.ts` — that's how NodeNext wants it.
- **No new top-level dirs without a reason.** If you're tempted to add
  `src/helpers/`, it probably belongs inside the stage that needs it.
- **Evidence subsystems must be pure-async and cacheable.** Don't mutate the
  filesystem from a gatherer.
- **Probe authors live in `corpus-default` (or third-party packages).**
  Don't put probes here — keep the engine probe-agnostic.

## Where to look for design intent

The design corpus is at the repo root: [`docs/design/`](../../docs/design/).
ADRs for the engine-level decisions are at
[`docs/adr/`](../../docs/adr/).
