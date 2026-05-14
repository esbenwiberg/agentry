# 0006 — Exclude generated files from cost-dimension probes

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

Dogfooding repofit against repofit surfaced a probe blind spot. Three
cost-dimension probes share the `size_stats` evidence subsystem:

- `size.large-files` — counts files over 2000 lines or 100KB.
- `size.repo-token-estimate` — divides total tracked bytes by a chars-per-
  token constant.
- `size.directory-depth` — p95 of path depth.

In the repofit repo, the only "large file" was `package-lock.json` (2985
lines, 100KB) and that lockfile contributed roughly half of the
`repo-token-estimate` byte count, pushing the score from 80 to 50.

The probes were technically right — the bytes exist — but they were
measuring the wrong thing. No agent reads a lockfile end-to-end. Counting it
as "agent context cost" punishes any repo that does the obviously correct
thing of committing its lockfile.

## Decision

Mark each `SizeStatsFile` with a `generated` flag during evidence gather.
Detection sources, in order:

1. `git check-attr linguist-generated <path>` — anything marked
   `linguist-generated=true` in `.gitattributes`.
2. A default filename list inside the `size-stats` subsystem:
   `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`,
   `Cargo.lock`, `Gemfile.lock`, `composer.lock`, `poetry.lock`,
   `Pipfile.lock`, `go.sum`, `flake.lock`, `mix.lock`, `pubspec.lock`,
   `npm-shrinkwrap.json`.

The evidence carries both raw and effective totals:

- `totalBytes` / `totalFiles` — includes generated files (raw signal).
- `totalBytesEffective` / `totalFilesEffective` — excludes generated files.

The two cost probes that measure agent burden (`size.large-files`,
`size.repo-token-estimate`) consume the *effective* totals and skip files
with `generated: true`. `size.directory-depth` still considers all files —
depth is a structural property of the repo layout, not a per-file cost.

## Rationale

The cost dimension is meant to model what an agent actually pays in context
tokens to navigate a repo. Lockfiles are committed but never read by agents.
A metric that conflates "bytes that exist on disk" with "bytes the agent
will load" is wrong about the thing it claims to measure — and dogfooding
showed exactly how wrong, on our own repo.

`.gitattributes linguist-generated=true` is the standard way to mark
generated files; supporting it means repos that already use it for GitHub
language stats automatically benefit. The default lockfile list is a
fallback for the common case where teams haven't bothered with
`.gitattributes`.

## Consequences

- Repos with large committed lockfiles score better — correctly, because
  they're not actually expensive for an agent.
- A repo that wants to mark something else as generated can add a
  `.gitattributes` entry; no code change needed.
- The `SizeStatsFile.generated` field and the new `*Effective` totals are
  optional in the type for back-compat with existing fixtures (they default
  to "not generated" / fall back to `totalBytes`).
- Third-party probes that consume `size_stats` should check
  `f.generated` if their semantic is "cost to the agent". Documented in
  the corpus-default CLAUDE.md.
