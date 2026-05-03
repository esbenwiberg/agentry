# 0002 — Catalog schema

**Status:** Accepted
**Date:** 2026-05-03

## Context

ADR-0001 locked the three-verb posture (`doctor` / `add` / `coach`) and
the A+C hybrid distribution split (Claude-flavoured `content/skills/`
plus tool-agnostic `content/recipes/`). It deliberately deferred the
declarative format that ties those trees together.

That format — the **catalog** — is now the load-bearing piece for every
verb:

- `doctor` reads catalog entries to decide what to look for.
- `add` reads catalog entries to know what files to install where.
- `coach` reads catalog entries to know what's already scaffolded vs
  what needs authoring.

Without a locked schema, those verbs can't be implemented coherently.
With a baroque schema, they collapse under their own weight.

## Decision

We will use **TOML files in `content/catalog/`, one file per entry**,
with the schema in [`content/catalog/schema.md`](../../content/catalog/schema.md).
Key locked choices:

1. **TOML, not JSON or YAML.** Hand-edited far more often than parsed;
   comments matter; TOML's structure is sufficient.
2. **One file per entry, filename equals `id`.** No index file. The CLI
   globs `*.toml`. Adding an entry is one new file; no central registry
   to keep in sync.
3. **Per-file flavor (`claude` / `agnostic`), not per-entry.** A single
   entry can ship both sides of the A+C split. The installer can filter
   (`--no-claude` / `--no-recipe`).
4. **Three conflict policies: `prompt` (default), `overwrite`,
   `skip-if-exists`.** No `merge` policy in v1 — Markdown merging is
   unreliable and tarpits design effort that's better spent elsewhere.
5. **Agnostic recipes install to `.agentry/recipes/`.** A tool-neutral
   dotfile location; not nested under `.claude/`. Any agent can be
   pointed at it.
6. **Detection via `[detect].any_of`.** A short list of canonical paths
   whose presence signals "installed." Future `all_of` is reserved.
7. **Capability scope = the union of `[[provides]].target` paths.** No
   separate capability list. The schema is the trust surface.
8. **No remote sources, no signing, no template substitution.** All
   content lives in this repo. Files copy byte-for-byte. Placeholder
   content is encoded inside source files (the `> *Example: ...*`
   convention from `content/templates/`).
9. **`requires.entries`** declares dependencies between catalog entries.
   The installer offers to pull dependents along; it doesn't auto-do it
   silently.
10. **Stable IDs.** Once published, an `id` is never repurposed. New
    semantics → new entry; old entry uses `deprecated_by` to redirect.

## Consequences

**Easier:**

- `doctor`, `add`, and `coach` all share one input format. Implementing
  any of them means parsing the same TOML.
- New entries cost one file. Contributors don't touch a central index.
- The trust surface is readable — open the entry, see exactly which
  paths it can write.
- `--no-claude` and `--no-recipe` flags fall out for free thanks to
  per-file flavor.

**Harder / accepted trade-offs:**

- No `merge` means a few use-cases (e.g., extending `core-rules.md` an
  adopter has already authored) require either a `prompt` + manual edit
  or a separate file. We accept this — auto-merging Markdown is worse.
- No template substitution means installable files can't customise
  themselves. Adopter renames / edits after install. For v1, this is a
  feature, not a bug — keeps the install boundary crisp.
- Agnostic recipes living in `.agentry/recipes/` introduces a new
  convention adopters need to learn. Documented, but it's still one
  more place to know about.

**Guardrails:**

- Schema changes need an amending ADR.
- New entries must validate against the rules in `schema.md`.
- An entry's `[[provides]].target` paths are its complete trust scope —
  validation rejects entries that try to write outside their declared
  set.

## Alternatives considered

- **JSON or YAML for entries.** YAML rejected for indentation and
  type-coercion footguns; JSON rejected for hostility to comments and
  human editing. TOML is the right level of structure for a config
  format that's read more by humans than by machines.
- **Single index file (`catalog.toml` listing all entries inline).**
  Rejected — central files become merge-conflict magnets. Glob is
  cheap; per-file is reviewable in isolation.
- **Per-entry flavor (entire entry is either Claude or agnostic).**
  Rejected — it forces every capability to ship as two separate
  catalog entries, doubling identifiers and confusing dependency
  graphs.
- **Auto-merge for Markdown files.** Rejected per ADR-0001 — merging
  agent context files reliably is unsolved. The honest answer is to
  prompt or to not overlap.
- **Template variable substitution at install time.** Rejected for v1
  — it makes the install boundary fuzzy, complicates `doctor`'s detect
  step (the installed file no longer matches the source), and pushes
  schema work into a templating language that doesn't exist yet.
  Future ADR territory if a real need shows up.
- **Capability list separate from `[[provides]]`.** Rejected — two
  sources of truth that would inevitably drift. The provided file list
  *is* the capability list.
- **Plugin-style remote/curl-fetched entries.** Rejected per ADR-0001's
  no-supply-chain-risk stance. Future stack overlays can ship as
  separate repos referenced by `requires`, but in v1 every entry lives
  here.
