---
type: FEAT
scope: cli
---

Introduce agentry.lock.toml that records what each entry installed at what version with sha256 checksums. Doctor now distinguishes user-edits (file diverged from both source and lockfile) from out-of-date (file matches lockfile but catalog source has moved on), and flags stale entries when the catalog version no longer matches the recorded install version. Add records or merges per-target on every successful install.
