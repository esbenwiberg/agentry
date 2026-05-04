# <TITLE> — Design

## Approach

High-level shape of the solution. One or two paragraphs. The reader
should be able to predict the file diff after this section.

## Contracts

Public-facing interfaces this introduces or changes — CLI flags,
function signatures, file formats, API endpoints, schemas. Be precise;
this is the part future contributors will grep for.

```
// example contract sketch
```

## Architecture

Where the new code lives, what existing modules it touches, what new
modules it introduces. A module-by-module breakdown is fine.

## Constraints

What the design is forced to honour:

- Backwards compatibility / migrations.
- Performance budgets.
- Tooling or platform limits.
- Existing ADRs that bound the solution space.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| ... | low/med/high | ... |

## Alternatives considered

Brief notes on rejected designs and why. Future-you wants this when
re-litigating.

## Open questions

Things still to decide before this leaves `Draft`. Resolve them or
explicitly punt to a follow-up spec.
