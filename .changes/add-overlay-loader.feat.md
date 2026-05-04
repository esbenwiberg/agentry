---
type: FEAT
scope: overlays
---

Add `loadOverlays(repoRoot)` — parses `agentry.overlays.toml` and each registered overlay's `agentry.overlay.toml` manifest, returning a `{ overlays, malformed }` shape that mirrors the catalog loader. Validates registration ids (ID_RE), path existence + directoryness, manifest id/version/description, and id mismatch between registration and manifest. First chunk of ADR-0004 (overlay plugin model) — no catalog merging yet. Exposes `ID_RE` and `SEMVER_RE` from `catalog.ts` and a `dirExists` helper from `io.ts` for reuse.
