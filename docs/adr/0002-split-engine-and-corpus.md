# 0002 — Split engine and default corpus into separate packages

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

The repofit pipeline has two halves with very different change cadences:

- The **engine** — CLI, runner, scorer, aggregator, evidence subsystems,
  SDK. Changes when the *machinery* changes. Breaking changes here force
  every corpus to rev.
- The **corpus** — individual probes, their scoring bands, their fixtures.
  Changes constantly as we tune thresholds and add probes.

The question was whether to ship these as one package (simpler install, one
import path) or two (clean pluggability, third-party corpora are first-class).

## Decision

Ship as two packages:

- `@esbenwiberg/repofit` — the engine, including the `repofit` CLI.
- `@esbenwiberg/corpus-default` — the default probe corpus, loaded by the
  CLI when no other corpus is configured.

The engine internals stay corpus-agnostic — the loader resolves corpora by
name from `repofit.config.json` and custom corpora use only the public SDK.
The published CLI package declares the default corpus as an npm dependency so
`npx @esbenwiberg/repofit` has a corpus available in its temporary install.

## Rationale

A monolithic build would have shipped sooner but the design only works if
third parties can publish their own corpora. The moment engine code statically
imports from the default corpus, the SDK becomes implicit ("you're a third
party if you re-implement everything we do, secretly") rather than a real
contract.

Splitting forces the SDK to be the *only* path between the two packages.
That's an unpleasant discipline at first — every gatherer, every type, every
helper has to choose a side — but it's the discipline that makes the
plugin model credible.

A tuning change to a single probe rev's the corpus version. Engine changes
that don't touch the SDK don't rev the corpus. Two packages, two release
cadences, one SDK contract. The CLI package's dependency on the default
corpus is a packaging affordance, not an internal import edge.

## Consequences

- Engine breaking changes force every corpus to rev. Tracked through
  [ADR-0005](./0005-corpus-pinning-in-baseline.md) — the baseline pins
  corpus version so a corpus bump is a visible CI event, not a silent score
  drift.
- Third-party corpora are a real path. The probe-authoring docs at
  [`docs/authoring.md`](../authoring.md) describe the SDK they target.
- Two packages = two `package.json` files, two `tsconfig`s, two
  `vitest.config`s. The duplication is mild and easier to live with than
  the alternative.
