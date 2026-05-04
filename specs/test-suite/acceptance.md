# Test suite — Acceptance

## Functional

- [ ] `vitest` is a devDependency in `package.json`; lockfile updated.
- [ ] `npm test` runs `vitest run` and exits 0 on a clean checkout.
- [ ] `npm run test:watch` works for development.
- [ ] `tests/helpers/cli.ts` exists and is used by every verb test.
- [ ] `tests/helpers/fixtures.ts` exists and is used by every verb test.
- [ ] `list` verb: ≥1 test (lists active entries; `--show-deprecated` flips deprecated visibility).
- [ ] `doctor` verb: ≥2 tests (empty repo → all `missing`; partial install → drift surfaced).
- [ ] `add` verb: ≥2 tests (install into empty fixture writes expected files + lockfile entry; conflict path with `--non-interactive` keeps existing).
- [ ] `upgrade` verb: ≥1 test (drift → file refreshed; lockfile checksum updated).
- [ ] `remove` verb: ≥1 test (file deleted, lockfile entry pruned).
- [ ] `coach` verb: ≥1 test per "well-shaped" kind (`claude-md`, `agent-profile`, `adr-init`, `spec-init`) — i.e. ones whose output is deterministic and not interactive-only.
- [ ] `drift.ts` unit tests: cover each `DriftKind` classification (`missing` / `out-of-date` / `user-edit`) plus the `null` no-drift path.
- [ ] `lockfile.ts` unit tests: read empty / read populated / round-trip write.
- [ ] `catalog.ts` unit tests: loader rejects malformed entries; cycle detection in `requires.entries` fires.

## Non-functional

- [ ] Performance: full suite runtime < 10s on a stock laptop (M-series Mac, mid-tier Linux).
- [ ] Observability: failing test stdout is enough to diagnose without re-running locally.
- [ ] Documentation: `PRACTICES.md` testing section updated to point at the live conventions; `README.md` mentions `npm test`.
- [ ] No flake budget: ten consecutive `npm test` runs all pass on a clean checkout.

## Out of scope

- GitHub Actions / CI workflow wiring. Track in a follow-up spec or
  brief — the test command lands first, the CI plumbing follows.
- Coverage threshold gates (e.g., c8 minimums). Premature for this
  surface; revisit if coverage drift becomes a real signal.
- Mutation testing.
- E2E tests against a real network or remote git.
- TeamPlanner round-trip integration (Phase 5).

## Verification

| Criterion | How verified |
|---|---|
| `npm test` exits 0 | Run on a clean checkout; observe exit code. |
| Verb contract tests | Each test file exists, asserts on file effects + exit code. Reviewer reads the test list and confirms coverage. |
| Drift / lockfile unit tests | Each `DriftKind` enum value has at least one test that produces it. |
| Suite < 10s | `time npm test` reported in PR description. |
| No flake | `for i in {1..10}; do npm test; done` all green, captured in PR. |
| Docs updated | `PRACTICES.md` + `README.md` diffs reviewed. |
