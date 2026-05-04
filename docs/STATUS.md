# agentry — status

Current snapshot of where the build is against the original 7-phase plan
(`~/.claude/plans/lets-brainstorm-the-idea-cheerful-pelican.md`). Update as
phases close.

## Phase progress

| Phase | Plan | State |
|---|---|---|
| 0. Bootstrap | New repo, package layout, dogfood | ✅ done — flat `src/` + `content/` layout, not the planned `packages/{cli,kernel,stack-dotnet}` monorepo. Has own `CLAUDE.md`, `docs/adr/`, `.changes/` |
| 1. Kernel extraction | 7-layer template hand-extracted from TeamPlanner | 🟡 in progress — `content/skills/` + `content/recipes/` exist; 6 catalog entries (commits, changelog, code-review, pull-requests, git-hooks, ship). Templates: `CLAUDE.md`, nested `CLAUDE.md`, `PRACTICES.md`, `.agent.toml` (ADR-0003). Specs scaffold still deferred |
| 2. CLI MVP | `agentry init` + `agentry doctor` | ⚠️ pivoted — no monolithic `init`. Composable verbs instead: `list`, `doctor`, `add`, `upgrade`, `remove`, `coach`. Better separation of concerns; revisit if first-run UX needs a one-shot |
| 3. Plugin model + first overlay | Manifest, capability sandbox, `@stack/dotnet` | ❌ not started. Catalog is currently bundled-only — no external plugin loading |
| 4. `agentry upgrade` | Re-render + 3-way merge | ✅ done — lockfile-as-truth model, `--force` to overwrite user-edits, `--dry-run`, `--non-interactive` |
| 5. TeamPlanner round-trip | Rip out hand-built `.claude/`, re-init via agentry | ❌ not started. TeamPlanner intentionally untouched until kernel + plugin model prove out |
| 6. Helpers + community overlays | `spec new`, `adr new`, third-party stacks | 🟡 partial — `coach adr-init` and `coach adr` ship; no `spec` helper; no community overlay surface yet |

## What works today

- `agentry list` — catalog browser, `--show-deprecated` flag
- `agentry doctor [path]` — 7-layer audit, classifies missing / out-of-date / user-edit drift via shared `src/drift.ts`
- `agentry add <id> [path]` — installs an entry, auto-resolves `requires.entries` deps (lockfile-aware), conflict prompts, `--no-claude` / `--no-recipe` / `--no-deps` / `--non-interactive` / `--dry-run`
- `agentry upgrade [id] [path]` — refreshes installed entries from catalog
- `agentry remove <id> [path]` — uninstalls, `--force` deletes user-edits, prunes lockfile
- `agentry coach <kind>` — un-installable scaffolding (`claude-md`, `practices`, `agent-profile`, `adr-init`, `adr`)
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

## Next likely work

Pick one:
1. **Specs scaffold** — `coach spec-init` + `coach spec <name>` mirroring the
   ADR helpers. Last unchecked Phase 1 kernel item; small surface, big payoff
   for adopters who want the briefs/contracts/AC convention out of the box.
2. **Start Phase 3 plugin model** — manifest schema, capability scoping, `add`
   resolves an external catalog source. Highest-risk phase in the plan;
   biggest leap in capability.
3. **Phase 5 dogfood** — round-trip TeamPlanner now to surface kernel gaps
   before plugin work locks in assumptions.

Default recommendation: **(1)**. Cheap to ship, finishes the kernel chapter,
and the spec convention is one of the highest-leverage things agentry can
hand a new repo.

## Persistence note

This file is the project's progress log. The plan file in `~/.claude/plans/`
is a static brainstorm snapshot and does not update. There is no agentry
auto-memory yet (memory is namespaced to TeamPlanner). Update this STATUS.md
when phases close or scope shifts.
