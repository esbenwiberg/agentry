# 0004 — Ratchet baseline as the default gate mode

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

Once probes produce a fitness number, CI needs to decide what to do with it.
The candidates:

- **Absolute threshold** — fail if fitness < N, fail if any probe < M. Simple
  to explain, but to adopt repofit a team must first sweep their repo to
  green. Most teams won't.
- **Ratchet** — record current state as a baseline, fail only on regression
  against it. Adoption-friendly: any repo, any score, can land repofit on
  day one and start ratcheting up.
- **Advisory only** — report scores, never fail. No teeth, no behavior
  change.

## Decision

**Ratchet is the default.** Absolute thresholds and advisory-only are
supported as opt-ins via `repofit.config.json`. The CLI's first-run
experience is `repofit check` → if no baseline exists, prompt to bootstrap
one; subsequent runs gate against it.

The baseline lives in `repofit-baseline.json` at repo root, is committed,
and is updated via `repofit check --accept` when the team explicitly raises
the bar.

## Rationale

The binding constraint is adoption. A repo-fitness tool that requires a
green-sweep PR before adoption is one that doesn't get adopted — the
green-sweep is exactly the work the tool is supposed to motivate, and asking
for it upfront flips cause and effect.

Ratchet inverts the dynamic: every commit either *holds* the line or
*raises* it. The team chooses when to invest in raising — and the tool's
job is to make those investment moments feel cheap (per-probe `explain`,
fixers, sharp remediation strings).

Absolute thresholds remain an option for teams that want to commit to a
floor publicly. Advisory mode exists for the "we want the signal but not
the verdict" case (early adoption, low-confidence repos, etc.). The default
should be the path of least resistance, and ratchet is it.

## Consequences

- `repofit-baseline.json` is a tracked artifact. Reviewers need to know
  what a baseline change means in a PR — captured in [`docs/design/config-
  and-baseline.md`](../design/config-and-baseline.md).
- The baseline can drift if `--accept` is run carelessly. CI runs only
  `check`, never `--accept` — the accept step is human-gated.
- Corpus version bumps invalidate ratchet comparisons. Handled via
  [ADR-0005](./0005-corpus-pinning-in-baseline.md).
