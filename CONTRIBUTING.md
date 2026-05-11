# Contributing to repofit

repofit is a CLI that measures how agent-friendly a repo is. This guide
explains the conventions and tooling you need to know to land a change.

## Project layout

npm workspaces monorepo with two packages:

- `packages/engine` — `@esbenwiberg/repofit`: CLI, evidence subsystems,
  runner, scorer, reporters.
- `packages/corpus-default` — `@esbenwiberg/corpus-default`: bundled
  probes and dimension definitions.

Design corpus lives in [`docs/design/`](docs/design/). Read it before
proposing architectural changes.

## Setup

```bash
git clone https://github.com/esbenwiberg/repofit.git
cd repofit
npm install
.githooks/install-hooks.sh
```

`install-hooks.sh` wires `.githooks/pre-commit` (secret scan) and
`.githooks/commit-msg` (conventional-commit shape).

## Development loop

```bash
npm run typecheck      # tsc --noEmit on both packages
npm run lint           # biome check
npm run build          # emit dist/ for both packages
npm test               # vitest run on both packages
```

CLI smoke test once built:

```bash
node packages/engine/dist/cli/index.js --version
```

Node 22+. TypeScript strict ESM NodeNext. Biome handles both lint and
format — no Prettier.

## Branches and commits

- Branch off `main`; name branches `<scope>/<short-topic>`.
- One logical change per PR. Split unrelated work.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): subject` where `type` is one of `feat`, `fix`, `docs`,
  `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `breaking`, `security`. The `commit-msg` hook enforces this.
- No `--no-verify`. If a hook fails, fix the underlying issue.

## Adding a probe

Probes live one-per-file under `packages/corpus-default/src/probes/`.

1. `defineProbe({ ... })` with id, version, dimensions, tier, evidence,
   rationale, `detect`, `score`, and fixtures.
2. Add at least one fixture per branch of `detect`. Fixtures run as
   tests via the engine's fixture runner.
3. Register the probe in `packages/corpus-default/src/index.ts`.
4. If the probe introduces a new dimension, add it to
   `packages/corpus-default/src/dimensions/` and register it too.

See [`docs/design/probe-schema.md`](docs/design/probe-schema.md) for
the full schema and [existing probes](packages/corpus-default/src/probes/)
for examples.

## Tests

- Unit and fixture tests run under `vitest`. No mocking of the file
  system — use the fixture-evidence hydrators.
- New behavior needs a test. New probes need fixtures covering every
  reading-kind branch.
- `npm test` is the gate; both packages must pass.

## Dogfood policy

repofit checks itself in CI via `repofit check`. `repofit.config.json`
pins the corpus and disables three probes that don't apply:

- `changelog.strategy-declared` — repofit deliberately has no CHANGELOG
  discipline pre-v1; release notes will be written manually at ship.
- `docs.adr-presence` — design decisions live in `docs/design/`, which
  serves the same purpose but doesn't match the ADR file convention
  the probe looks for.
- `secrets.precommit-scan-configured` — the probe matches well-known
  scanners (gitleaks, secretlint, etc); repofit's `.githooks/pre-commit`
  runs a hand-rolled scanner that the probe can't recognize.

If you disagree with a disable, the right path is to propose either a
probe improvement (so the probe matches reality) or a real fix (e.g.
swap in a recognized scanner).

## Submitting

1. Open a PR against `main`.
2. CI runs `typecheck`, `lint`, `build`, `test`, and a `repofit check`
   dogfood gate.
3. Address review comments with follow-up commits, not force-pushes.
