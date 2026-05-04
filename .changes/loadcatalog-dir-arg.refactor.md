---
type: REFACTOR
scope: catalog
---

`loadCatalog()` now accepts an optional catalog-dir override (defaults to the bundled `content/catalog/`). Lets unit tests point the loader at fixture catalogs to exercise cycle detection and malformed-entry handling without touching the bundled set. No behavior change for existing callers.
