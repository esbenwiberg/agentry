# Contributing to repofit

repofit is a CLI that measures how agent-friendly a repo is. This guide
focuses on the contributor-specific bits: how to author a probe, the
dogfood policy, and the submission flow.

For environment setup, the dev loop (`typecheck`, `lint`, `build`,
`test`), and commit conventions, see [`README.md`](README.md) and
[`CLAUDE.md`](CLAUDE.md). For architecture, see
[`docs/design/`](docs/design/) — start with
[`README.md`](docs/design/README.md).

## Setting up hooks

After `npm install`, wire the local hooks:

```bash
.githooks/install-hooks.sh
```

This installs `.githooks/pre-commit` (secret scan) and
`.githooks/commit-msg` (conventional-commit shape). Do not bypass with
`--no-verify`; fix the underlying issue.

## Adding a probe

Probes live one-per-file under `packages/corpus-default/src/probes/`.

1. `defineProbe({ ... })` with id, version, dimensions, tier, evidence,
   rationale, `detect`, `score`, and fixtures. See
   [`docs/design/probe-schema.md`](docs/design/probe-schema.md).
2. Add at least one fixture per branch of `detect`. Fixtures run as
   tests via the engine's fixture runner.
3. Register the probe in `packages/corpus-default/src/index.ts`.
4. If the probe introduces a new dimension, add it to
   `packages/corpus-default/src/dimensions/` and register it. See
   [`docs/design/dimensions.md`](docs/design/dimensions.md).

For how scores aggregate into dimensions and the report shape, see
[`docs/design/reports.md`](docs/design/reports.md). For how a project
pins corpora, gates, and ratchets, see
[`docs/design/config-and-baseline.md`](docs/design/config-and-baseline.md).

## Dogfood policy

repofit gates itself in CI via `repofit check --ci`. The static/derived/
historical tiers run by default; executed-tier probes (latency.*,
*.clean, branch-protection) are intentionally not part of the CI gate
to keep the pipeline fast — run them locally with
`npx repofit --include executed`.

`repofit.config.json` pins the corpus and disables three probes that
don't apply:

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
2. CI runs typecheck, lint, build, test, and the `repofit check`
   dogfood gate.
3. Address review with follow-up commits, not force-pushes.
