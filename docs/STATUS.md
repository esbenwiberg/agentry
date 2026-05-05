# agentry — status

*Last updated: 2026-05-04 — ADR-0005 pivot shipped. Scan + brief MVP, `upgrade --check` drift gate, bundled catalog migrated to practices-only, `doctor` removed, brief inlines practice content. 132 tests, ~1.6s. TeamPlanner round-trip dogfood deferred per user direction.*

Current snapshot of where the build is. The original 7-phase plan is
superseded for the verb taxonomy by ADR-0005; this file tracks the new
shape.

## Verb surface (post-ADR-0005)

| Verb | Posture | What it does |
|---|---|---|
| `agentry scan` | Audit | Deterministic evidence bundle in `.agentry/scan/<ts>/`. Fitness tests default-on (`--no-fitness` opts out). |
| `agentry brief` | Author handoff | Emits `instructions.md` against the latest bundle; inlines bundled practice docs + catalog snapshot for the agent. |
| `agentry list` | Browse | Shows merged catalog (bundled + overlays); `[practice]` tag distinguishes practices from artifacts. |
| `agentry add <id>` | Install | Drops in overlay artifact entries. Rejects practice ids with a redirect to `brief` / overlays. |
| `agentry upgrade [id]` | Refresh | Refreshes installed artifacts from the merged catalog. `--force` overwrites user-edits, `--non-interactive`, `--dry-run`. |
| `agentry upgrade --check` | CI gate | Reports drift (missing / out-of-date / user-edit / orphaned); exits 0 clean, 1 on drift. Replaces `doctor`. |
| `agentry remove <id>` | Uninstall | Deletes installed files and prunes the lockfile. |
| `agentry coach <kind>` | Author | Bespoke scaffolding without the full scan loop (`claude-md`, `practices`, `agent-profile`, `adr-init`/`adr`, `spec-init`/`spec`). |

## Three-layer opinion model

| Layer | Owns | Form |
|---|---|---|
| Bundled catalog | Universal practices | Markdown guidance docs (`kind = "practice"`, no `[[provides]]`). |
| Overlays | Team-canonical artifacts + practice overrides | Byte-perfect files registered via `agentry.overlays.toml`. |
| Scan + brief + agent | Per-repo tailoring | The user's coding agent authors files; re-scan verifies. |

The bundled catalog ships zero artifacts post-pivot. Anything that has
to be byte-perfect for a team lives in an overlay that team controls.

## What works today

- **Scan** (`src/scan/`): manifest, structure (tree + languages + manifests), git (stats, commit messages, hot files, PR samples), hygiene (LICENSE, README, CI coverage, linters, gitignore audit), security (secrets-suspects, committed-keys, lockfile-age, audit), agent-readiness inventory (CLAUDE.md / ADRs / specs / configs / staleness), docs (README head, root headings, claude-md), fitness (build/test/typecheck/lint, default-on with `--no-fitness` opt-out), catalog snapshot (entries + overlays + inlined practice MDs to `practices/<id>.md`).
- **Brief** reads the bundle's `manifest.json` + `catalog.json` and writes `instructions.md` with bundle pointers, reading rules, fitness warnings, gatherer failures, and a Practice library section that inlines each practice doc verbatim.
- **Catalog**: `kind = "practice" | "artifact"` discriminator; practice entries declare `practice = "<repo-relative path>"` and skip provides/detect; artifact entries unchanged.
- **`upgrade --check`** classifies drift across the lockfile (incl. orphaned overlay/bundled entries) and exits 1 on any signal.
- **Overlays** (ADR-0004): `agentry.overlays.toml` registration, per-overlay manifest, merged catalog with last-wins, `overlay` field in lockfile, orphaned drift detection.
- **`add` / `upgrade` / `remove`** lifecycle for overlay artifacts; conflict-aware on every collision; lockfile-as-truth model; `--force` overwrites user-edits.
- **`coach`**: `claude-md` (with `--nested <subdir>`), `practices`, `agent-profile`, `adr-init`/`adr <slug>`, `spec-init`/`spec <slug>`.

## ADR status

| ADR | Status |
|---|---|
| 0000 — Record architectural decisions | Accepted |
| 0001 — Product posture (doctor/add/coach) | Superseded for verb taxonomy by 0005; amended by 0004 for plugin model. Posture (read / opt-in write / never-fabricate) survives with `scan` as the read entry point. |
| 0002 — Catalog schema | Accepted; `kind` discriminator added by 0005. |
| 0003 — Agent profile schema | Accepted. |
| 0004 — Overlay plugin model | Accepted; role expanded by 0005 (overlays own team-canonical artifacts). |
| 0005 — Scan-driven core, catalog as practices | Accepted; dogfood (TeamPlanner round-trip) deferred per user direction. |

## What's left

- **TeamPlanner round-trip dogfood.** The deferred validation gate. Run agentry against a real non-trivial repo, confirm the brief produces useful agent output, and amend ADR-0005 if structural problems surface.
- **Community overlay surface.** Plan's Phase 6. Not started.
- **CHANGELOG generation from `.changes/` fragments.** TBD; CI not wired yet.

## Persistence note

This file is the project's progress log. Update when phases close or
scope shifts. The plan file in `~/.claude/plans/` is a static brainstorm
snapshot and does not update.
