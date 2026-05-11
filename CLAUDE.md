# agentry

> **Active design work**: a successor architecture called **trim** is in design
> review under `docs/design/` (start with `docs/design/README.md`). No code
> against the trim design has been written yet — the scan-driven agentry
> codebase below is what currently ships.

A CLI that helps any repo become agent-ready. Scan-driven core (ADR-0005):

- `scan` — deterministic evidence bundle (read-only)
- `brief` — emits `instructions.md` for the user's coding agent
- `add` / `upgrade` / `remove` — overlay artifact lifecycle
- `upgrade --check` — drift CI gate (formerly `doctor`)
- `coach` — bespoke authoring without the full loop
- `list` — browse merged catalog

## Architecture

Single npm package. **Node 22+**, **TypeScript** (strict, ESM, NodeNext).

```
src/         — CLI source (TS)
  scan/      — gatherers + brief renderer
  commands/  — verb implementations
content/     — what ships with the agentry npm package
  catalog/   — practice entries (kind="practice"); zero artifacts post-ADR-0005
  practices/ — markdown guidance bodies referenced by catalog entries
.changes/    — changelog fragments (dogfood)
.githooks/   — commit-msg + secret scan (dogfood)
_scripts/    — changelog helpers (dogfood)
docs/adr/    — agentry's own architectural decisions (dogfood)
```

The bundled catalog ships **practices** (markdown guidance the agent
reads and adapts). Byte-perfect team artifacts live in **overlays**
registered via `agentry.overlays.toml`. agentry uses its own conventions
on itself.

## Key Conventions

- **Commits:** `type(scope): subject` — see `docs/adr/0000-record-architecture-decisions.md`, and `.changes/README.md`.
- **Changelog fragments required for:** feat, fix, refactor, perf, build, breaking, security. Skip for: test, docs, style, ci, chore.
- **Hooks enforce this** — never `--no-verify`. Fix the underlying issue.
- **No CHANGELOG.md edits** — generated from fragments by CI (TBD).
- **Posture:** `scan` reads, `add` / `upgrade` / `remove` write opt-in, `coach` never fabricates content. See ADR-0005 (supersedes ADR-0001 for the verb taxonomy).

## Build & Test

```bash
npm install            # install deps
npm run typecheck      # strict TS
npm run build          # emit dist/
node dist/index.js     # run the CLI (until bin link)
```

## Where to find things

| What | Where |
|---|---|
| Locked design decisions (agentry) | `docs/adr/` |
| Open design notes | `docs/decisions/` |
| **Successor architecture (trim) — in design review** | `docs/design/` (start with `README.md`) |
| Conventions for contributors | `PRACTICES.md` |
| Bundled practice entries | `content/catalog/` |
| Practice guidance bodies | `content/practices/` |
| Overlay author guide | `docs/overlays.md` |
