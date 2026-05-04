# 0004 — Overlay plugin model (local paths, catalog as trust surface)

**Status:** Accepted
**Date:** 2026-05-04

## Context

ADR-0001 locked "no plugin runtime, no manifest-with-capabilities
enforcement, no marketplace, no remote plugin fetching" as v1
non-goals. That was the right call when the kernel was unproven. As of
this ADR, the kernel ships, six catalog entries are stable, the
lockfile model is in production use, and 83 tests cover the verb
contracts.

Phases 3 and 5 of the original plan both depend on a way for *external*
content to plug into the catalog — a `@stack/dotnet` overlay (Phase 3)
needs to ship lint/coverage skills without forking `agentry`, and the
TeamPlanner round-trip (Phase 5) wants to keep TeamPlanner-private
skills out of the public catalog while still using the same drift /
upgrade / remove machinery.

The brainstorm plan proposed a `[capabilities]` manifest with
parallel keys for skills/commands/hooks/scripts/settings_keys/
context_files/fitness_tests/agent_profile. That schema duplicates the
catalog's `[[provides]].target` list — and ADR-0002 already locked
"capability scope = the union of `[[provides]].target` paths." Two
trust surfaces drift; we pick one.

The honest question: what is the *minimum* plugin model that unblocks
Phases 3 and 5 without re-introducing the failure modes ADR-0001
explicitly rejected (runtime daemon, marketplace, supply-chain risk
via remote fetch, enforcement-engine maintenance)?

## Decision

We will support **local overlay sources only**, registered explicitly
by the adopter, resolved at `add` / `upgrade` / `remove` / `doctor`
time. No daemon, no marketplace, no remote fetching in v1.

### 1. Overlay shape

An overlay is a directory whose layout mirrors `content/` from this
repo:

```
my-overlay/
  agentry.overlay.toml      # required — overlay manifest
  catalog/                  # required — TOML entries, same schema as ADR-0002
    foo.toml
  skills/                   # optional — claude-flavoured skill content
    foo/
      skill.md
  recipes/                  # optional — agnostic recipe content
    foo/
      foo.md
  templates/                # optional — coach-scaffolded templates
```

The `agentry.overlay.toml` manifest is intentionally minimal:

```toml
id = "stack-dotnet"           # bare id, same grammar as catalog entries
version = "0.1.0"             # semver; bumped when overlay content changes
description = ".NET stack overlay (lint, coverage, fitness rules)"
```

`id` follows the same `^[a-z][a-z0-9-]*$` grammar the catalog
validator already enforces (`ID_RE` in `src/catalog.ts`). No `@` or
`/` namespacing — the overlay's *source* (which directory it was
loaded from) is the namespace; the id is a key for collisions and
log lines. We deliberately reject npm-style `@scope/name` here —
two trust surfaces (filesystem path + scope) would drift, and the
validator already rejects those characters.

No `[capabilities]` block. The catalog entries inside `catalog/`
declare what files the overlay can install via their existing
`[[provides]].target` lists — the same trust surface bundled entries
use. Reading the catalog *is* reading the capability scope.

We deliberately do not include a `min_agentry` field in v1.
Compatibility shows up as a malformed-entry error from the
catalog validator the moment something breaks — that's a louder
signal than a silently-skipped overlay. We can add `min_agentry`
in a follow-up ADR the first time we ship a breaking schema
change.

### 2. Registration

An adopter registers overlays in `agentry.overlays.toml` at the repo
root:

```toml
[[overlay]]
id = "@stack/dotnet"
path = "../my-stack-overlay"     # relative to the repo root
```

The CLI reads `agentry.overlays.toml` at startup of any verb that
loads the catalog. Each registered overlay's `agentry.overlay.toml`
manifest is parsed and validated; its `catalog/*.toml` files are
loaded with the same loader the bundled catalog uses (ADR-0002).

If `agentry.overlays.toml` is missing, the CLI behaves exactly as it
does today (bundled catalog only). The file is opt-in; existing
adopters see no behaviour change.

### 3. Source types in v1

- **Local relative paths.** Resolved against the consuming repo's
  root. Adopter chose where the overlay lives — clone, symlink, git
  submodule, monorepo sibling, vendored copy — agentry doesn't care.
- **No git refs**, **no npm registry**, **no http(s) fetching** in
  v1. We will not run `git clone` or `npm install` on the adopter's
  behalf. If they want a git-tracked overlay, they clone it
  themselves and point `path` at the clone.
- **No registry / discovery / search.** No `agentry search`, no
  community list. Overlays are discovered out-of-band (README,
  docs, word of mouth). We can revisit when there are five real
  overlays in the wild.

### 4. Layering and conflict resolution

When an overlay catalog defines an entry whose `id` collides with the
bundled catalog or another overlay:

- **Last registered wins.** Bundled is loaded first; then each
  `[[overlay]]` in registration order. The last entry with a given
  `id` is the active one. Earlier entries are reported as shadowed
  in `agentry list --show-shadowed` (a flag added when the first
  collision shows up; YAGNI until then).
- **Override is at entry level, not provide level.** An overlay
  entry replaces the bundled entry wholesale. We will not attempt
  per-provide patching — that's the same merge-Markdown tarpit
  ADR-0001/0002 already rejected.
- **Cross-overlay deps work.** `requires.entries = ["other-overlay-id"]`
  is resolved against the merged catalog after registration. The
  existing cycle detector and the unknown-id check both run **once,
  across the merged set** — never per-source. A bundled entry that
  requires an overlay-only id is valid, provided the overlay is
  registered.
- **Malformed overrides fail loud.** When an overlay declares an
  entry whose `id` collides with the bundled catalog and the
  overlay entry is malformed (validator rejects it), the bundled
  entry stays active *and* the overlay is reported by `doctor` /
  `list` as having attempted a broken override. Silent fallback is
  worse than an explicit warning.

### 5. Capability scope (trust surface)

An overlay's writeable paths = the union of `[[provides]].target`
across its catalog entries. Same as bundled. The existing catalog
validator already rejects:

- Absolute paths and `..` segments in `target` (per `isRepoRelative`
  in `src/catalog.ts`).
- Sources outside the overlay's `content/` mirror (we extend the
  existing source-existence check to resolve relative to the
  overlay root, not `CONTENT_DIR`).

There is **no separate capability list**, no enforcement daemon,
no signed manifests. The overlay author writes `[[provides]]`
honestly; the validator catches the mechanical mistakes; the
adopter reads the manifest before registering. This is the same
trust posture as bundled entries — the only difference is who
authored the catalog file.

### 6. Lockfile semantics

The lockfile (`agentry.lock.toml`, ADR-0002) gains one optional
field per `[[installed]]` entry:

```toml
[[installed]]
id = "lint"
version = "0.1.0"
overlay = "@stack/dotnet"     # NEW — omitted means bundled
installed_at = "..."
provides = [...]
```

`doctor` and `upgrade` look up the entry's source by `(overlay, id)`
instead of just `id`. If a registered overlay disappears between
runs, `doctor` reports the affected installed entries as **orphaned**
(distinct from missing/out-of-date/user-edit) so the adopter can
decide to re-register, remove, or convert to user-edit ownership.
This is a new `DriftKind` — implementation lands in the same change
that ships overlay loading.

`upgrade` does **not** modify orphaned entries. Their source is
gone; refreshing them is undefined. The verb skips them with an
explicit message and exits non-zero if any orphans existed in the
plan. The adopter resolves by re-registering the overlay (entries
become normal), running `remove --force` (deletes user-edits and
prunes the lockfile), or running `remove` (lockfile-prune only,
files stay as user-owned).

Overlay version bumps work through the existing upgrade machinery:
when an overlay's `agentry.overlay.toml` `version` changes, the
catalog `version` deltas drive the same `out-of-date` classification
that bundled bumps drive today. No new mechanism — the lockfile's
locked `version` per-entry already covers this.

### 7. Out of scope (still)

Carried forward from ADR-0001, explicitly:

- **No runtime daemon, no MCP server.** Resolution is sync, at verb
  invocation.
- **No marketplace, no curated index, no `agentry search`.**
- **No remote fetching, no `curl | bash`, no `npm install` on the
  adopter's behalf.** Adopter clones overlays themselves.
- **No memory stores, approval gates, correction loops.** Runtime
  agent concerns, not CLI scaffolding.
- **No template substitution at install time.** Per ADR-0002.
- **No per-provide patching across overlays.** Last entry wins
  wholesale.
- **No signed manifests / capability enforcement engine.** The
  catalog `[[provides]]` list is the trust surface; the validator
  is the enforcement.

## Consequences

**Easier:**

- Phase 3 unblocks: `@stack/dotnet` is an overlay directory the
  adopter clones and registers. No new content lives in this repo.
- Phase 5 round-trip has a clean home for TeamPlanner-private
  skills without leaking them into the public catalog.
- The trust surface is still readable — open the overlay manifest
  + its catalog and you know exactly what the overlay can write.
- Existing adopters see zero change until they create
  `agentry.overlays.toml`.
- The same drift / upgrade / remove / doctor machinery extends
  with one new `DriftKind` (orphaned).

**Harder / accepted trade-offs:**

- Overlay authors must redeclare schema-valid catalog entries — no
  shortcuts. We accept this; the validator catches the mistakes.
- Last-wins override is blunt. If two overlays both want to extend
  the same bundled entry, the adopter chooses the registration
  order. We accept this; per-provide merging is worse.
- Adopters managing overlays manually (clone, pull, register) is
  more friction than `agentry install @stack/dotnet`. We accept
  this; remote fetch reopens the supply-chain question we already
  answered.
- `agentry doctor` cost grows linearly with overlay count. Not a
  v1 concern — register five overlays and it's still cheap.

**Guardrails:**

- A new ADR amends this one if we ever add remote fetching, a
  registry, or enforcement beyond the catalog validator. None of
  those are forced moves.
- Overlay manifests must validate; malformed manifests are
  reported the same way malformed catalog entries are today
  (skipped + warned, no crash).
- The `overlay` lockfile field is additive — older lockfiles (no
  `overlay` key) read as bundled-only entries.

## Alternatives considered

- **Full plugin manifest with `[capabilities]` block (brainstorm
  plan version).** Rejected — duplicates `[[provides]].target` as
  a parallel trust surface. Two surfaces drift. ADR-0002 already
  picked the catalog as authoritative.
- **Remote git refs in v1 (`source = "git+https://..."`).**
  Rejected — reopens supply-chain risk, requires us to manage
  clones/cache/auth, and pulls a chunk of `simple-git`-shaped
  complexity into a CLI that does not need it yet. Adopter clones
  it themselves.
- **npm-registry-published overlays (`@stack/dotnet` as an npm
  package).** Rejected for the same supply-chain reason and
  because it conflates "I want to extend the catalog" with "I'm
  publishing JavaScript code." Overlays are content, not code.
- **Per-provide layering (overlay can override one file in a
  bundled entry).** Rejected — same Markdown-merge tarpit
  ADR-0002 already rejected. Override at entry granularity keeps
  the trust surface readable.
- **Auto-discovery via `node_modules/agentry-overlay-*` scan.**
  Rejected — implicit registration violates the "open the file,
  see what'll be loaded" property. Explicit `agentry.overlays.toml`
  registration is the trust posture.
- **Marketplace / community index.** Deferred. Need five real
  overlays before designing curation. Until then the friction of
  manual registration is fine.
- **`@scope/name` style ids (npm-package-name shape).** Rejected —
  the catalog validator's `ID_RE` already locks `^[a-z][a-z0-9-]*$`,
  and loosening it to allow `@` and `/` would create two namespaces
  (filesystem path of the overlay + scope inside the id) that can
  drift. Bare ids with explicit override are simpler. If there's
  ever a real collision (e.g. two overlays both want `lint`), the
  adopter chooses registration order; `agentry list` surfaces the
  shadow.
- **`min_agentry` version gate.** Deferred. We have not made a
  breaking schema change yet; adding the field before we know
  what compatibility actually means is premature. Schema breaks
  surface as malformed-entry errors today, which is the right
  loud signal. Revisit when the second breaking change ships.
