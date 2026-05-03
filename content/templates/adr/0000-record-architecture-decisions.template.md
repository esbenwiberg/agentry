# 0000 — Record architectural decisions

**Status:** Accepted
**Date:** <YYYY-MM-DD>

## Context

<PROJECT_NAME> needs a place to record locked design decisions so future
contributors (and future-us) can read the *why*, not just the *what*.
Commit messages rot; design context vanishes; tribal knowledge leaves
when people do.

The standard answer is Architectural Decision Records (Michael Nygard's
format, lightly adapted): one Markdown file per locked decision, numbered
sequentially, never renumbered.

## Decision

We will use ADRs in `docs/adr/`. Each ADR captures one locked decision
in a fixed format (Context / Decision / Consequences / Alternatives).
They are sequentially numbered, never renumbered, and amended by
*superseding* rather than rewriting.

`docs/decisions/` is the parallel drawer for in-flight design notes that
have not yet been locked. ADRs graduate out of `decisions/` once accepted.

## Consequences

- New design decisions cost one Markdown file. Cheap.
- Future contributors can audit *why* without reading commit history.
- Locked decisions become referenceable from PRs, issues, and skills.
- We accept the small overhead of writing an ADR for genuinely-locked
  decisions. Trivial calls live in code, not here.

## Alternatives considered

- **No formal record, just commit messages.** Rejected — commits rot,
  decision context is harder to retrieve than the change.
- **A single `DECISIONS.md` log.** Rejected — merge conflicts on every
  contribution, no atomic supersession, hard to link from PRs.
- **External wiki / doc tool.** Rejected — splits source of truth from
  the repo and breaks `git blame` workflows.
