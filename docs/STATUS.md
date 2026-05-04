# agentry — status

Current snapshot of where the build is against the original 7-phase plan
(`~/.claude/plans/lets-brainstorm-the-idea-cheerful-pelican.md`). Update as
phases close.

## Phase progress

| Phase | Plan | State |
|---|---|---|
| 0. Bootstrap | New repo, package layout, dogfood | ✅ done — flat `src/` + `content/` layout, not the planned `packages/{cli,kernel,stack-dotnet}` monorepo. Has own `CLAUDE.md`, `docs/adr/`, `.changes/` |
| 1. Kernel extraction | 7-layer template hand-extracted from TeamPlanner | 🟡 in progress — `content/skills/` + `content/recipes/` exist; 6 catalog entries (commits, changelog, code-review, pull-requests, git-hooks, ship). Specs/ADR templates not yet bundled as catalog entries |
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
- `agentry coach <kind>` — un-installable scaffolding (`claude-md`, `practices`, `adr-init`, `adr`)
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
- **No `.agent.toml` yet.** Plan called this out as a kernel deliverable. Schema bikeshed unresolved — flagged as Phase 1 risk in the original plan, still open.
- **No `PRACTICES.md` template** in `content/`. Same status as `.agent.toml` — kernel artifact not yet authored.

## Next likely work

Pick one:
1. **Finish Phase 1 kernel** — author `.agent.toml` schema + template, `PRACTICES.md` template, root `CLAUDE.md` template, specs scaffold. Closes the kernel before touching the plugin model.
2. **Start Phase 3 plugin model** — manifest schema, capability scoping, `add` resolves an external catalog source. Highest-risk phase in the plan; biggest leap in capability.
3. **Phase 5 dogfood** — round-trip TeamPlanner now to surface kernel gaps before plugin work locks in assumptions.

Default recommendation: **(1)**. Phase 3 wants a complete kernel to layer on; round-tripping TeamPlanner is more useful once the kernel is whole.

## Persistence note

This file is the project's progress log. The plan file in `~/.claude/plans/`
is a static brainstorm snapshot and does not update. There is no agentry
auto-memory yet (memory is namespaced to TeamPlanner). Update this STATUS.md
when phases close or scope shifts.
