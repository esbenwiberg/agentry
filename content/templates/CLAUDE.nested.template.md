# <SUBSYSTEM_NAME>

> Per-subdirectory context. Loaded by Claude Code (and similar tools)
> when files in this subtree are in scope. Keep it short and specific to
> *this* subdirectory — global context belongs in the root `CLAUDE.md`.

> Replace this quote-block with one or two sentences about what lives in
> this subdirectory and what makes it different.

> Example: *"Frontend application code. React 18 + TypeScript + Fluent
> UI. State via React Query. The component library is in
> `Client/src/components/`."*

## Conventions specific to this subtree

> Anything that's true here but not true elsewhere in the repo. Don't
> repeat root-level conventions.

- > *Example: "Components must be functional with hooks — no class
  > components."*
- > *Example: "All API calls go through `services/api/`, never `fetch`
  > directly from a component."*

## Key entry points

> Pointers to the files a new agent should read first when working in
> this subtree.

- `<path>` — *purpose*
- `<path>` — *purpose*

## Build & test (subtree-specific)

> Only if commands here differ from root. Otherwise drop this section.

```bash
<command if different from root>
```

## Pitfalls

> Things that *will* trip up an agent unfamiliar with this subtree.
> Document the bear traps.

- > *Example: "Hot reload doesn't pick up changes to `vite.config.ts` —
  > restart the dev server."*
- > *Example: "Tests in this folder require an emulator running on
  > port 8081."*

## Related

- Root context: `../CLAUDE.md` (or however many `..` it takes)
- Architecture overview: `<link>`
- Specs / specs touching this subtree: `<link>`
