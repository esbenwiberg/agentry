# 0003 — Agent profile schema (`.agent.toml`)

**Status:** Accepted
**Date:** 2026-05-04

## Context

Across AI coding tools — Claude Code, Cursor, Aider, Continue, autopod,
codex CLIs — every one of them needs the same handful of facts about a
repository to do useful work: how to build it, how to test it, how to
run it, where the source lives, where the tests live, whether there's a
health endpoint to probe.

Each tool has its own answer today. Claude reads `CLAUDE.md`, Cursor
reads `.cursorrules`, Aider reads `.aider.conf.yml`, Continue reads
`.continuerc.json`, autopod reads its own profile. Agents end up either
guessing from the file tree or asking the user the same questions every
session.

agentry's brainstorm plan flagged a tool-agnostic profile file as a
kernel deliverable. The risk it called out: ending up with a Claude-
shaped schema that other tools can't (or won't) read.

This ADR locks the v1 schema before any tooling depends on it.

## Decision

We will ship a kernel template at
`content/templates/agent.template.toml` that the `coach agent-profile`
verb writes to a target repo as `.agent.toml`. The schema:

```toml
schema_version = "1"
name           = "<string>"
description    = "<string>"

[stack]
languages  = ["<lowercase-string>", ...]
frameworks = ["<lowercase-string>", ...]

[commands]
install = "<shell command or empty string>"
build   = "<shell command or empty string>"
test    = "<shell command or empty string>"
lint    = "<shell command or empty string>"
format  = "<shell command or empty string>"
dev     = "<shell command or empty string>"
start   = "<shell command or empty string>"

[paths]
src   = ["<repo-relative path>", ...]
tests = ["<repo-relative path>", ...]
docs  = ["<repo-relative path>", ...]

[health]
url = "<URL or empty string>"

[agents]
context_files = ["<repo-relative path>", ...]
adr_dir       = "<repo-relative path>"
```

Locked choices:

1. **TOML.** Same rationale as ADR-0002: hand-edited often, comments
   matter, structure is sufficient.
2. **`schema_version = "1"`** is a string, not a number. Future-proof
   against `"1.1"` / `"2"`.
3. **Seven canonical commands** — `install`, `build`, `test`, `lint`,
   `format`, `dev`, `start`. Surveyed across Aider, Cursor, Continue,
   autopod, Claude Code workflows; these are the union of "things a
   coding agent commonly needs to invoke." No `deploy` (out of agent
   scope), no `bench` (rarely used by agents), no `clean` (composable
   from `build`).
4. **Empty string = "not configured."** Tools treat this as "skip this
   capability." Distinguishing missing-key from empty-string is
   pedantic; the file always declares all seven keys for discoverability.
5. **Free-form `stack.languages` / `stack.frameworks`.** No fixed
   taxonomy. Lowercase strings, agents pattern-match. A locked taxonomy
   ages badly and creates argument surface.
6. **Repo-relative paths only, forward-slash separated.** Same rule
   already used by the catalog (ADR-0002). No tilde, no absolute paths,
   no `..` traversal.
7. **`[health]` is optional but always present.** An empty `url`
   declares "no health endpoint" without forcing the table to be absent.
8. **`[agents]` table for agent-specific hints.** The other tables are
   universal; this one is where agentry-defined or per-tool keys live.
   v1 ships `context_files` and `adr_dir` — both are already-established
   conventions in the kernel.

## Consequences

**Easier:**

- Any agent that adds `.agent.toml` support gets seven consistent
  facts about every repo. No bespoke detection code per project.
- The schema is small enough to memorise. A reader can predict what's
  in a `.agent.toml` without opening one.
- Adding a new repo to an agent's tooling is one file.

**Harder / accepted trade-offs:**

- Adoption is the gating factor. If no other tool reads `.agent.toml`,
  this is a Claude file with extra steps. Mitigation: keep the schema
  minimal and document it publicly so other tools can implement it
  cheaply; revisit at Phase 5 if cross-tool reads aren't materialising.
- `stack.languages` / `stack.frameworks` being free-form means no
  validation of values. Trade-off accepted — the alternative is a
  taxonomy committee.
- Multi-component repos (monorepo with .NET backend + React frontend)
  flatten into one profile. v1 handles them with multi-element
  `paths.src` and pipeline commands (`npm run build && dotnet build`).
  If that gets ugly in practice, a future ADR can introduce per-
  component sub-tables.

**Guardrails:**

- Schema changes bump `schema_version` and ship an amending ADR.
- The `coach agent-profile` writer always emits the full v1 shape with
  placeholders, so adopters never end up with a partial file.
- Tools reading `.agent.toml` should be tolerant of unknown keys
  (forwards-compat) and treat missing keys as empty.

## Alternatives considered

- **JSON or YAML.** Same rationale as ADR-0002 — TOML wins for hand-
  edited config with comments.
- **Tighter command list (just `build` / `test` / `dev`).** Rejected —
  excluding `lint` and `format` would force agents to guess these,
  which is exactly what `.agent.toml` is supposed to prevent. `install`
  is needed because it's a precondition for the other commands on a
  fresh checkout.
- **Looser command list (free-form `[commands]` table with arbitrary
  keys).** Rejected for v1 — ambiguity about which key means what makes
  cross-tool reads unreliable. Future ADR territory if specific
  domains (data pipelines, mobile apps) need extension keys.
- **Embed the agent profile in `package.json`-style sidecar metadata.**
  Rejected — couples the profile to one ecosystem's package manager,
  defeating the cross-stack goal.
- **Borrow autopod's profile schema verbatim.** Rejected per the
  plan's "agentry and autopod evolve independently" decision. We may
  converge later via a published spec; for v1, agentry owns its shape.
- **Per-component sub-tables in v1.** Rejected as premature. Most
  repos are single-component or composable; revisit if real monorepos
  produce uncomfortable single-line pipeline commands.
- **Schema enforced by JSON Schema / TOML schema.** Rejected for v1 —
  adds a runtime dep and a moving piece. Prose spec + reader tolerance
  is enough until adoption demands stricter validation.
