# 0005 — Pin corpus name and version inside the baseline

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

A probe's score depends on its scoring bands. Tweak a band — say, change
`size.repo-token-estimate` from `≤200_000 → 80` to `≤180_000 → 80` — and
every repo's score for that probe moves *without any change to the repo*.

That's a serious failure mode for a ratcheting gate
([ADR-0004](./0004-ratchet-baseline-default-gate.md)): an unrelated `npm
update` could turn green CI red overnight, or silently raise the bar so the
team's next commit "regresses" against a baseline that was implicitly
upgraded.

We need a way to say "this baseline is paired with this version of these
probes" so that scoring drift is visible.

## Decision

The baseline records the corpus packages and their versions:

```json
{
  "corpus": [
    { "package": "@esbenwiberg/corpus-default", "version": "1.0.0" }
  ],
  "fitness": 91.04,
  "probes": { "...": 100 }
}
```

When `repofit check` runs, it compares the installed corpus version against
the baseline's pinned version. Any mismatch produces a **corpus-drift**
warning, and ratchet comparisons are scoped to probes that exist in both
versions. A clean way forward is `repofit check --accept` to take a new
snapshot against the upgraded corpus.

## Rationale

We want corpus authors to feel free to tune scoring — that's how the corpus
gets better. We also want a CI gate that doesn't move under teams' feet.
Those two are in tension, and the tension is exactly what version pinning is
for: tuning is welcome, the upgrade moment is a *deliberate* one that the
team owns.

Pinning by exact version (not semver range) is intentional. Even a patch bump
to a probe corpus can swing a score; treating those as silently compatible
would reproduce the failure mode this ADR exists to prevent.

## Consequences

- Bumping the default corpus requires every consumer to run `--accept` once
  to re-snapshot. That's visible churn — and it's the *right* visibility.
- The baseline carries a versioned dependency on the corpus packages. If a
  corpus is unpublished or moved, the gate can't run; the baseline file
  surfaces this with a clear error rather than silently scoring against
  whatever's installed.
- This ADR also implies probes have **stable ids across versions** —
  renaming `size.large-files` to `cost.large-files` is a breaking corpus
  change, not a cosmetic one.
