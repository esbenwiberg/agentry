# agentry — status

*Last updated: 2026-05-04 — Phase 3 design locked (ADR-0004 overlay plugin model); 83 tests, ~1.2s.*

Current snapshot of where the build is against the original 7-phase plan
(`~/.claude/plans/lets-brainstorm-the-idea-cheerful-pelican.md`). Update as
phases close.

## Phase progress

| Phase | Plan | State |
|---|---|---|
| 0. Bootstrap | New repo, package layout, dogfood | ✅ done — flat `src/` + `content/` layout, not the planned `packages/{cli,kernel,stack-dotnet}` monorepo. Has own `CLAUDE.md`, `docs/adr/`, `.changes/` |
| 1. Kernel extraction | 7-layer template hand-extracted from TeamPlanner | ✅ done — `content/skills/` + `content/recipes/` exist; 6 catalog entries (commits, changelog, code-review, pull-requests, git-hooks, ship). Templates: `CLAUDE.md`, nested `CLAUDE.md`, `PRACTICES.md`, `.agent.toml` (ADR-0003), specs (`coach spec-init` + `coach spec`) |
| 2. CLI MVP | `agentry init` + `agentry doctor` | ⚠️ pivoted — no monolithic `init`. Composable verbs instead: `list`, `doctor`, `add`, `upgrade`, `remove`, `coach`. Better separation of concerns; revisit if first-run UX needs a one-shot |
| 3. Plugin model + first overlay | Manifest, capability sandbox, `@stack/dotnet` | 🟡 design locked (ADR-0004) — local overlay paths only, catalog as trust surface, no daemon/marketplace/remote fetch. Loader + `agentry.overlays.toml` registration + orphaned `DriftKind` are next |
| 4. `agentry upgrade` | Re-render + 3-way merge | ✅ done — lockfile-as-truth model, `--force` to overwrite user-edits, `--dry-run`, `--non-interactive` |
| 5. TeamPlanner round-trip | Rip out hand-built `.claude/`, re-init via agentry | ❌ not started. TeamPlanner intentionally untouched until kernel + plugin model prove out |
| 6. Helpers + community overlays | `spec new`, `adr new`, third-party stacks | 🟡 partial — helpers ✅ (`coach adr-init`/`adr`, `coach spec-init`/`spec`); community overlay surface ❌ not started |

## What works today

- `agentry list` — catalog browser, `--show-deprecated` flag
- `agentry doctor [path]` — 7-layer audit, classifies missing / out-of-date / user-edit drift via shared `src/drift.ts`
- `agentry add <id> [path]` — installs an entry, auto-resolves `requires.entries` deps (lockfile-aware), conflict prompts, `--no-claude` / `--no-recipe` / `--no-deps` / `--non-interactive` / `--dry-run`
- `agentry upgrade [id] [path]` — refreshes installed entries from catalog
- `agentry remove <id> [path]` — uninstalls, `--force` deletes user-edits, prunes lockfile
- `agentry coach <kind>` — un-installable scaffolding (`claude-md`, `practices`, `agent-profile`, `adr-init`, `adr`, `spec-init`, `spec`)
- `agentry.lock.toml` — provenance + checksums, drives all three drift verbs

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
- **First per-feature spec implemented:** `specs/test-suite/` (Status: Active). vitest wired (`pretest` builds dist; `npm test` runs the suite). 83 tests at ~1.2s — verb contract tests for list/doctor/add/upgrade/remove/coach, dispatch tests for index.ts (help/version/unknown-verb/missing-arg/upgrade id-vs-path disambiguation), unit tests for drift/lockfile (read/write round-trip + sha256 + sort + malformed-provide drop)/catalog (validation: bad TOML, bad semver, duplicate targets, unknown-id deps, cycles)/io/typeguards. Helpers at `tests/helpers/{cli,fixtures}.ts`.
- **CI online:** `.github/workflows/ci.yml` runs `npm ci → typecheck → test` on push/PR to `main`. Single Ubuntu job, Node 22, npm cache keyed on `package-lock.json`, read-only permissions. Brief at `specs/test-suite/briefs/01-ci-workflow.md`.

## Next likely work

Phase 3 implementation, in chunks:

1. **`agentry.overlays.toml` parser + registration validation.** Read
   the file, validate manifest fields, surface malformed entries the
   same way the catalog loader does. No catalog wiring yet.
2. **Overlay catalog loader.** Extend `loadCatalog` to merge bundled
   + registered overlays with last-wins semantics. Update source
   resolution to root each overlay's `[[provides]].source` against
   its own root, not `CONTENT_DIR`.
3. **`overlay` field in lockfile + orphaned `DriftKind`.** Lockfile
   round-trip preserves the field; `doctor` reports orphaned when
   the registered overlay is gone.
4. **First overlay fixture in `tests/fixtures/`.** Drives
   end-to-end add → doctor → upgrade → remove against an overlay
   that ships one synthetic catalog entry. No external repo yet.
5. **Phase 5 dogfood** — round-trip TeamPlanner once overlays work.
   Still needs TeamPlanner access.

Default next: **(1)**. Smallest contained change that proves the
manifest schema before any catalog code touches it.

## Persistence note

This file is the project's progress log. The plan file in `~/.claude/plans/`
is a static brainstorm snapshot and does not update. There is no agentry
auto-memory yet (memory is namespaced to TeamPlanner). Update this STATUS.md
when phases close or scope shifts.
