# 0003 — Evidence subsystem registry as the gather-and-cache primitive

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

Most probes need similar inputs: the file tree, `package.json`, `.gitignore`,
CI workflows, commit history, repo size stats. A naive design would have each
probe read its inputs directly inside `detect()`.

Two problems with that:

1. **Cost.** Thirty probes that each `readFile("package.json")` is thirty
   syscalls when one would do. `git ls-files` is even more expensive.
2. **Testability.** A probe that calls `readFile` directly can't be unit-tested
   with fixtures — every test needs a real filesystem.

## Decision

Introduce an **evidence subsystem registry**. Each subsystem (`files`,
`agent_config`, `node_package`, `gitignore`, `size_stats`, `ci_workflows`,
`commit_history`, `commands`, `github_api`, `judge`) implements
`{ gather(ctx) => Promise<Evidence> }`. The runner gathers all subsystems
*once* before scheduling probes, then passes the resulting `EvidenceMap` to
every `detect()` call.

Probes declare which evidence keys they consume (`evidence: ["size_stats",
"files"]`). The fixture runner accepts a plain `evidence:` object and hydrates
each subsystem from the shape it expects.

## Rationale

The two problems share a solution. Caching evidence at gather-time is the
direct fix for the cost problem; gather-time evidence is *also* the seam
fixture tests need. A probe that does `ev.size_stats.files.filter(...)` is
trivially testable — pass a synthetic `size_stats`.

The alternative (each probe owns its IO) optimizes nothing and tests poorly.
The alternative-to-the-alternative (one giant evidence blob that contains
everything) makes the boundary between gatherers fuzzy and tempts probes to
reach across subsystems for inputs that should be a new subsystem.

The discipline that pays off: **a gatherer is the only path to the
filesystem**. If a probe needs new data, the answer is "add a subsystem", not
"add a side-channel read inside `detect()`".

## Consequences

- Probes are pure functions of evidence. Fixtures are trivial.
- Adding a new evidence input means writing a gatherer, declaring its type,
  and registering it. Slightly more ceremony than reading a file inline —
  the ceremony is the point.
- The fixture runner has to mirror every subsystem's hydration logic. See
  `packages/engine/src/fixtures/runner.ts`. When you add a subsystem, add
  the hydrator there too — the type system will tell you if you forget.
