# 0000 — Record architectural decisions

**Status:** Accepted
**Date:** 2026-05-03

## Context

`agentry` is being built solo, with the explicit aim of being adopted by
other repos and (eventually) other contributors. Decisions made today —
naming, posture, plugin model, distribution — will be re-litigated in six
months when context has decayed. We need a place to write them down so
future-us (and future contributors) can read the *why*, not just the *what*.

The standard answer is Architectural Decision Records (Michael Nygard's
format, lightly adapted): one Markdown file per locked decision, numbered
sequentially, never renumbered.

## Decision

We will use ADRs in `docs/adr/`. Each ADR captures one locked decision in
a fixed format (Context / Decision / Consequences / Alternatives). They are
sequentially numbered, never renumbered, and amended by superseding rather
than rewriting.

`docs/decisions/` is the parallel drawer for in-flight design notes that
have not yet been locked. ADRs graduate out of `decisions/` once accepted.

## Consequences

- New design decisions cost one Markdown file. Cheap.
- Future contributors can audit *why* without reading commit history.
- `agentry` itself ships an ADR convention into target repos (eventually
  via `agentry add adr`), so dogfooding the practice here keeps that
  template honest.
- We accept the small overhead of writing an ADR for genuinely-locked
  decisions. We do *not* accept ADR-soup — trivial calls live in code,
  not here.

## Alternatives considered

- **No formal record, just commit messages.** Rejected — commit messages
  rot, and the decision context is harder to retrieve than the change.
- **A single `DECISIONS.md` log.** Rejected — merge conflicts on every
  contribution, no atomic supersession, hard to link from issues/PRs.
- **Wiki / external doc tool.** Rejected — splits the source of truth
  away from the repo and breaks `git blame` / `git log` workflows.
