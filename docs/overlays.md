# Overlays — author guide

An overlay is a directory of catalog entries you register into a repo so
`agentry` can install, audit, upgrade, and remove them through the same
verbs the bundled catalog ships with. This guide walks through writing
one. The design rationale lives in
[ADR-0004](adr/0004-overlay-plugin-model.md); this document is the
practical "how do I ship one" companion.

## When to write an overlay

Reach for an overlay when you have skills, recipes, hooks, or templates
that:

- aren't a fit for the public bundled catalog (stack-specific,
  org-private, experimental); **or**
- need to ride the `add` / `upgrade` / `doctor` / `remove` machinery
  rather than living as loose files an adopter copies in by hand.

If you just want to share a single Markdown file, that's a gist, not an
overlay.

## File layout

An overlay mirrors the bundled `content/` tree:

```
my-overlay/
  agentry.overlay.toml      # required — overlay manifest
  catalog/                  # required — TOML entries (ADR-0002 schema)
    foo.toml
    bar.toml
  skills/                   # optional — `flavor = "claude"` content
    foo/
      skill.md
  recipes/                  # optional — `flavor = "agnostic"` content
    foo/
      foo.md
  templates/                # optional — coach scaffolds
    foo.template.md
```

Sources referenced from `[[provides]]` resolve **against the overlay's
own root**, not against `agentry`'s bundled `content/`. So
`source = "skills/foo/skill.md"` means
`my-overlay/skills/foo/skill.md`.

A working example lives at [`tests/fixtures/overlays/acme/`](../tests/fixtures/overlays/acme).

## The overlay manifest

`agentry.overlay.toml` is intentionally minimal:

```toml
id          = "stack-dotnet"
version     = "0.1.0"
description = ".NET stack overlay (lint, coverage, fitness rules)"
```

Rules:

- **`id`** — bare lowercase, same grammar as catalog entry ids
  (`^[a-z][a-z0-9-]*$`). No `@scope/name` namespacing; the path you
  registered the overlay at is the namespace.
- **`version`** — semver. Bump when overlay content changes — adopters
  pick up the bump as `out-of-date` drift on the next `agentry doctor`
  or `agentry upgrade`.
- **`description`** — short prose; shown nowhere user-facing today,
  but lives in the manifest as documentation for adopters.

The manifest's `id` **must match** the registration id the adopter uses
(see below). Mismatch is reported as a malformed overlay.

## Catalog entries

Catalog files inside `catalog/` use the same schema as the bundled
catalog. See [ADR-0002](adr/0002-catalog-schema.md) for the full schema;
[`tests/fixtures/overlays/acme/catalog/acme-demo.toml`](../tests/fixtures/overlays/acme/catalog/acme-demo.toml)
is a minimal example:

```toml
id          = "acme-demo"
name        = "Acme demo entry"
description = "Synthetic entry shipped by the acme overlay"
version     = "0.1.0"
layers      = ["context"]

[[provides]]
source   = "skills/acme-demo/skill.md"        # relative to overlay root
target   = ".claude/skills/acme-demo/skill.md" # relative to adopter repo
flavor   = "claude"
conflict = "prompt"

[detect]
any_of = [".claude/skills/acme-demo/skill.md"]
```

Things to know that aren't obvious from the schema:

- **`requires.entries`** can reference bundled ids or other overlay
  ids. Cross-reference and cycle validation runs once across the
  merged catalog, not per-source — so an overlay entry can depend on
  a bundled entry, and vice versa, provided both are loaded.
- **`target` paths** are validated to be repo-relative — no absolute
  paths, no `..` segments. The catalog `[[provides]].target` list is
  the trust surface; an overlay can only write where it has a
  declared `target`.
- **`flavor`** is `"claude"` for `.claude/`-shaped content, `"agnostic"`
  for tool-neutral recipes. `agentry add --no-claude` /
  `--no-recipe` filter on this field.

## Registering the overlay

The adopter (the repo that wants to *use* the overlay) creates
`agentry.overlays.toml` at the repo root:

```toml
[[overlay]]
id   = "stack-dotnet"        # must match the manifest id
path = "../my-overlay"        # relative to adopter repo root
```

Multiple `[[overlay]]` blocks are allowed. **Order matters**: bundled
catalog loads first, then each `[[overlay]]` in registration order.
Last entry with a given id wins (ADR-0004 §4).

If `agentry.overlays.toml` is missing, behaviour is unchanged — bundled
catalog only.

## What the CLI does with an overlay

Once registered:

- **`agentry list`** — overlay entries appear in the listing tagged
  `[overlay:<id>]`. Bundled entries appear untagged.
- **`agentry add <id>`** — installs an overlay entry the same way it
  installs bundled entries. The lockfile records `overlay = "<id>"`
  on each `[[installed]]` block sourced from an overlay.
- **`agentry doctor`** — audits installed overlay entries with the
  same drift kinds (`missing`, `out-of-date`, `user-edit`). One extra
  kind is overlay-specific: **`orphaned`** — a locked entry whose
  catalog id has vanished from the merged catalog (overlay
  deregistered, overlay no longer ships the entry, or bundled entry
  removed). Doctor reports the reason in a dedicated `[orphaned]`
  section.
- **`agentry upgrade [id]`** — refreshes overlay entries from the
  overlay's own source tree when its `version` bumps or a `[[provides]]`
  source changes.
- **`agentry remove <id>`** — uninstalls; preserves the `overlay`
  field on partial removals.

`agentry doctor` distinguishes three orphaned reasons:

| Lockfile says | Catalog says | Reason |
|---|---|---|
| `overlay = "x"` | overlay `x` not registered | `overlay 'x' is not registered` |
| `overlay = "x"` | overlay `x` registered, no entry with this id | `overlay 'x' no longer ships entry` |
| no `overlay` | not in bundled catalog | `no longer in bundled catalog` |

## Versioning and drift

Bump `agentry.overlay.toml#version` *and* the affected
`catalog/<entry>.toml#version` whenever you change content. The
adopter's lockfile pins both — `version` drift between locked and
current shows up as `v<old>→<new>` in `agentry doctor` and triggers
`refresh-out-of-date` in `agentry upgrade`.

If you ship a `[[provides]]` content change without a version bump,
the file's sha256 still differs from the lockfile checksum, so doctor
classifies it as `out-of-date`. The version bump is for humans
reading the changelog; the checksum is what actually drives drift
detection.

## Common pitfalls

- **`source` resolves against the overlay root, not the adopter's
  repo.** The overlay's `skills/foo/skill.md` lives in
  `<overlay-root>/skills/foo/skill.md`, not the consumer.
- **Manifest id must match registration id.** Mismatch is reported as
  a malformed overlay (loaded from `agentry.overlays.toml` but skipped).
- **Overlay catalog files are still validated.** Bad TOML, bad semver,
  duplicate targets, unknown-id deps, and cycles are all rejected
  the same way the bundled loader rejects them.
- **No remote fetching in v1.** Adopters clone, symlink, or vendor
  overlays themselves. `path` is a local filesystem path; `git+https://`
  / npm registry / http(s) are not supported (see ADR-0004 §3).
- **No per-provide override across overlays.** An overlay entry
  replaces a bundled entry wholesale on id collision. If two
  overlays both want `lint`, registration order picks the winner;
  the loser is shadowed.

## Where to look in the codebase

| What | Where |
|---|---|
| Manifest + registration parser | `src/overlays.ts` |
| Merged catalog (bundled + overlays) | `src/merged-catalog.ts` |
| Lockfile `overlay` field | `src/lockfile.ts` |
| Drift kinds (incl. `orphaned`) | `src/drift.ts` |
| End-to-end fixture | `tests/fixtures/overlays/acme/` |
| End-to-end lifecycle test | `tests/overlay-e2e.test.ts` |
| Design rationale | `docs/adr/0004-overlay-plugin-model.md` |
