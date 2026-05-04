---
type: REFACTOR
scope: cli
---

`src/index.ts` now imports `AGENTRY_VERSION` from `src/version.ts` instead of redeclaring `VERSION = "0.0.0"`. Single source of truth — bumping the version no longer requires editing two files.
