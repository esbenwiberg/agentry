# agentry

A CLI that helps any repo become agent-ready. Three verbs: `doctor` (audit),
`add` (install installable bits), `coach` (interactive author un-installable
bits). Tool-agnostic — emits Claude Code skills *and* generic prompt recipes.

## Architecture

Single npm package. **Node 22+**, **TypeScript** (strict, ESM, NodeNext).

```
src/         — CLI source (TS)
content/     — what gets shipped INTO target repos
  catalog/   — declarative manifest of what `add` can install
  skills/    — generic skill markdown (lifted from any-stack work)
  recipes/   — tool-agnostic prompt recipes (cross-agent compat layer)
.changes/    — changelog fragments (dogfood)
.githooks/   — commit-msg + secret scan (dogfood)
_scripts/    — changelog helpers (dogfood)
docs/adr/    — agentry's own architectural decisions (dogfood)
```

agentry uses agentry's conventions on itself from day one. If something
doesn't work for our own repo, it doesn't ship.

## Key Conventions

- **Commits:** `type(scope): subject` — see `docs/adr/0000-record-architecture-decisions.md` once written, and `.changes/README.md`.
- **Changelog fragments required for:** feat, fix, refactor, perf, build, breaking, security. Skip for: test, docs, style, ci, chore.
- **Hooks enforce this** — never `--no-verify`. Fix the underlying issue.
- **No CHANGELOG.md edits** — generated from fragments by CI (TBD).
- **Posture:** `doctor` reads, `add` writes opt-in, `coach` never writes for you. See ADR-0001.

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
| Locked design decisions | `docs/adr/` |
| Open design notes | `docs/decisions/` |
| Conventions for contributors | `PRACTICES.md` |
| Things `add` can install | `content/catalog/` |
| Generic skills shipped to target repos | `content/skills/` |
| Cross-agent prompt recipes | `content/recipes/` |
