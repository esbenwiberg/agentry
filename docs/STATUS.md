# agentry — status

*Last updated: 2026-05-04 — Phase 3 chunks 1–5 shipped (manifest loader, merged catalog, lockfile overlay + orphaned drift, e2e overlay fixture, overlay author guide); 119 tests, ~1.4s.*

Current snapshot of where the build is against the original 7-phase plan
(`~/.claude/plans/lets-brainstorm-the-idea-cheerful-pelican.md`). Update as
phases close.

## Phase progress

| Phase | Plan | State |
|---|---|---|
| 0. Bootstrap | New repo, package layout, dogfood | ✅ done — flat `src/` + `content/` layout, not the planned `packages/{cli,kernel,stack-dotnet}` monorepo. Has own `CLAUDE.md`, `docs/adr/`, `.changes/` |
| 1. Kernel extraction | 7-layer template hand-extracted from TeamPlanner | ✅ done — `content/skills/` + `content/recipes/` exist; 6 catalog entries (commits, changelog, code-review, pull-requests, git-hooks, ship). Templates: `CLAUDE.md`, nested `CLAUDE.md`, `PRACTICES.md`, `.agent.toml` (ADR-0003), specs (`coach spec-init` + `coach spec`) |
| 2. CLI MVP | `agentry init` + `agentry doctor` | ⚠️ pivoted — no monolithic `init`. Composable verbs instead: `list`, `doctor`, `add`, `upgrade`, `remove`, `coach`. Better separation of concerns; revisit if first-run UX needs a one-shot |
| 3. Plugin model + first overlay | Manifest, capability sandbox, `@stack/dotnet` | ✅ done — chunks 1–5 shipped: `agentry.overlays.toml` parser (`src/overlays.ts`), merged catalog with last-wins (`src/merged-catalog.ts`), lockfile `overlay` field + `orphaned` DriftKind + doctor reporting + verbs wired to merged loader, e2e fixture at `tests/fixtures/overlays/acme/` driving add/doctor/upgrade/remove, author guide at `docs/overlays.md`. ADR-0004 |
| 4. `agentry upgrade` | Re-render + 3-way merge | ✅ done — lockfile-as-truth model, `--force` to overwrite user-edits, `--dry-run`, `--non-interactive` |
| 5. TeamPlanner round-trip | Rip out hand-built `.claude/`, re-init via agentry | ❌ not started. TeamPlanner intentionally untouched until kernel + plugin model prove out |
| 6. Helpers + community overlays | `spec new`, `adr new`, third-party stacks | 🟡 partial — helpers ✅ (`coach adr-init`/`adr`, `coach spec-init`/`spec`); community overlay surface ❌ not started |

## What works today

- `agentry list [path]` — catalog browser (bundled + overlays at path), `--show-deprecated` flag, marks overlay-sourced entries with `[overlay:<id>]`
- `agentry doctor [path]` — 7-layer audit, classifies missing / out-of-date / user-edit / orphaned drift via shared `src/drift.ts`. Orphaned = locked entry whose id has vanished from the merged catalog
- `agentry add <id> [path]` — installs an entry (bundled or overlay), auto-resolves `requires.entries` deps (lockfile-aware), conflict prompts, `--no-claude` / `--no-recipe` / `--no-deps` / `--non-interactive` / `--dry-run`. Records `overlay = "<id>"` in lockfile when the entry came from an overlay
- `agentry upgrade [id] [path]` — refreshes installed entries from the merged catalog (bundled + overlays)
- `agentry remove <id> [path]` — uninstalls, `--force` deletes user-edits, prunes lockfile (preserves `overlay` field on partial removal)
- `agentry coach <kind>` — un-installable scaffolding (`claude-md`, `practices`, `agent-profile`, `adr-init`, `adr`, `spec-init`, `spec`)
- `agentry.overlays.toml` — registers local overlay paths; each overlay ships its own `agentry.overlay.toml` manifest + `catalog/` dir
- `agentry.lock.toml` — provenance + checksums + overlay attribution, drives all four drift kinds

## Bonus shipped (not in original plan)

- `remove` verb (plan stopped at `init`/`add`/`upgrade`/`doctor`)
- Three-state `DepDecision` (`skip` / `ask` / `auto-install`) so `--non-interactive` doesn't leave broken installs
- Cycle detection in catalog loader (DFS gray/black coloring)
- Shared `DriftKind` classifier — single source of truth for doctor/upgrade
- Glyph language: `·` keep, `!` force, `~` refresh, `+` write, `-` delete

## Known deviations from plan

- **Layout:** flat `src/` + `content/`, not `packages/{cli,kernel,stack-dotnet}`. Fine for solo + bundled catalog; revisit if/when plugin model lands and a stack overlay needs its own package.
- **No `init`:** composable verbs replace it. Adopters run `add` per entry. If first-run UX gets noisy, add a thin `init` that calls `add` for the kernel set.
- **`.agent.toml` schema locked in ADR-0003.** Template ships at `content/templates/agent.template.toml`, scaffolded via `coach agent-profile`. Cross-tool adoption is still the open risk — revisit at Phase 5.
- **`PRACTICES.md` template** ships at `content/templates/PRACTICES.template.md`, scaffolded via `coach practices`.
- **Spec templates** ship at `content/templates/spec/` (`README` + `_template/{purpose,design,acceptance}.md` + `briefs/README.md`), scaffolded via `coach spec-init` then `coach spec <slug>`. Slug-named, not numbered (specs are features, not point-in-time decisions).
- **`specs/` bootstrapped on agentry itself** via `coach spec-init` — the repo now ships its own `specs/README.md` and `specs/_template/`.
- **First per-feature spec implemented:** `specs/test-suite/` (Status: Active). vitest wired (`pretest` builds dist; `npm test` runs the suite). 119 tests at ~1.4s — verb contract tests for list/doctor/add/upgrade/remove/coach, dispatch tests for index.ts (help/version/unknown-verb/missing-arg/upgrade id-vs-path disambiguation), unit tests for drift/lockfile (read/write round-trip + overlay round-trip + sha256 + sort + malformed-provide drop)/catalog (validation: bad TOML, bad semver, duplicate targets, unknown-id deps, cycles)/overlays/merged-catalog/io/typeguards. Doctor covers orphaned-detection paths (registered overlay missing + bundled-removed). Overlay e2e at `tests/overlay-e2e.test.ts` runs the full lifecycle against `tests/fixtures/overlays/acme/`. Helpers at `tests/helpers/{cli,fixtures}.ts`.
- **CI online:** `.github/workflows/ci.yml` runs `npm ci → typecheck → test` on push/PR to `main`. Single Ubuntu job, Node 22, npm cache keyed on `package-lock.json`, read-only permissions. Brief at `specs/test-suite/briefs/01-ci-workflow.md`.

## Next likely work

Phase 3 remaining:

1. ✅ `agentry.overlays.toml` parser + registration validation (`src/overlays.ts`).
2. ✅ Overlay catalog loader — merged bundled + overlays with last-wins (`src/merged-catalog.ts`); per-entry `sourceRoot` so commands resolve overlay sources against the overlay's own root.
3. ✅ `overlay` field in lockfile + `orphaned` `DriftKind`. Lockfile round-trips the field; `doctor` reports orphaned with reason (`overlay '<x>' is not registered` / `overlay '<x>' no longer ships entry` / `no longer in bundled catalog`).
4. ✅ End-to-end overlay fixture at `tests/fixtures/overlays/acme/` — `tests/overlay-e2e.test.ts` covers list attribution, add → lockfile overlay field, doctor (installed and orphaned-after-deregistration), upgrade user-edit detection, upgrade --force restoring from overlay-rooted source, remove cleanup.
5. ✅ Overlay author docs at `docs/overlays.md` — file layout, manifest contract, registration, lifecycle through list/add/doctor/upgrade/remove, orphaned-reason matrix, common pitfalls, codebase pointers.
6. **Phase 5 dogfood** — round-trip TeamPlanner once overlays work. Still needs TeamPlanner access.

Default next: **(6)** — Phase 5 dogfood (TeamPlanner round-trip), or move to a non-Phase-3 follow-up (community overlay surface for Phase 6, or `init` thin wrapper if first-run UX needs it).

## Persistence note

This file is the project's progress log. The plan file in `~/.claude/plans/`
is a static brainstorm snapshot and does not update. There is no agentry
auto-memory yet (memory is namespaced to TeamPlanner). Update this STATUS.md
when phases close or scope shifts.
