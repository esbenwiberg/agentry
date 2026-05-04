---
type: BUILD
scope: tests
---

Add vitest test suite. `npm test` builds via `pretest` then runs the suite against `dist/`. 37 tests at ~650ms — verb contract tests for list/doctor/add/upgrade/remove/coach + unit tests for drift, lockfile, and catalog (real bundled catalog plus fixture catalogs for cycle detection and malformed-entry handling). Helpers at `tests/helpers/{cli,fixtures}.ts`.
