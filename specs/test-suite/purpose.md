# Test suite — Purpose

**Status:** Draft
**Date:** 2026-05-04

## Problem

`src/` has grown from a stub into 10+ files (`catalog`, `drift`,
`lockfile`, `prompt`, plus six command files), with non-trivial logic
in drift classification, dependency resolution, and lockfile
provenance. Verification today is hand-driven smoke tests in tmpdirs
per loop iteration. `package.json` already carries a placeholder:
`"test": "echo 'test placeholder — wire vitest when src grows'"`, and
`PRACTICES.md` explicitly flags this as overdue.

The risk is regressions in subtle paths — drift kind classification,
`requires.entries` cycle detection, `--non-interactive` defaults — going
unnoticed across refactors. The simplify loop has already touched
`coach.ts`, `add.ts`, `upgrade.ts`, `remove.ts`, and `drift.ts` in
recent history; each was a manual smoke-test gamble.

## Goals

- Every CLI verb (`list`, `doctor`, `add`, `upgrade`, `remove`, `coach`)
  has at least one happy-path **contract test**: given a fixture repo,
  what gets written and what gets reported.
- The non-trivial pure modules (`drift`, `lockfile`, `catalog` loader)
  have unit tests covering their decision boundaries.
- `npm test` is real (not a placeholder) and exits non-zero on
  regression.
- Test runs are fast enough to leave on `--watch` during development
  (target: full suite under 5s on a stock laptop).

## Non-goals

- 100% line coverage. Aim for high-leverage tests at logic boundaries;
  glue and trivial wiring are skipped.
- Filesystem mocking. Tests use real tmpdirs — if it doesn't work on a
  real FS, it doesn't ship. Matches the project's dogfood philosophy.
- Snapshot-everything. Reserve snapshots for `doctor` output (where the
  report itself is the contract) and avoid them elsewhere to dodge
  churn.
- TeamPlanner / external repo round-trip — that's Phase 5 territory.
- CI workflow wiring (GitHub Actions). Tracked separately; see
  `acceptance.md` "Out of scope".

## Success criteria

- A new contributor can run `npm test` after `npm install` and get a
  green suite without further setup.
- Adding a test for a new verb requires only copying a sibling test
  file and editing fixtures — no vitest documentation lookup.
- The next refactor that breaks `drift.ts` or `lockfile.ts` semantics
  fails CI before reaching `main`.
- `npm test` runtime stays under 10s wall-clock for the lifetime of
  v0.x.

## Stakeholders

- agentry maintainer — primary user; needs the safety net for
  refactor-heavy iterations.
- agentry adopters — secondary; a tested CLI is more trustworthy to
  install into their repos.
