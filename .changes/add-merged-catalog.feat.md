---
type: FEAT
scope: catalog
---

Add `loadMergedCatalog(repoRoot)` — bundled catalog + every registered overlay in registration order, last-wins on id collision per ADR-0004 §4. Cross-reference and cycle validation now run *once* across the merged set, so a bundled entry can require an overlay-only id (and vice versa) provided both are loaded. Result includes `shadowed: CatalogEntry[]` for the entries that lost the last-wins race, distinct from `malformed: MalformedEntry[]` (parse + cross-ref failures, tagged with `overlay` when applicable). Refactors `parseEntry` to take `sourceRoot` + `overlayId` so per-overlay sources resolve against the overlay's own root, not bundled `CONTENT_DIR`. Splits `loadCatalog` into `loadCatalogSource` + `validateCrossReferences` so the merged loader can compose them without rerunning validation per source. `validateCrossReferences` now returns its result instead of mutating in place.
