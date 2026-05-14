# Reasoned-judge probe tier

> Status: shipped (Apr 2026). See `packages/engine/src/evidence/subsystems/judge.ts`,
> `packages/engine/src/reporters/html.ts`, and probes under
> `packages/corpus-default/src/probes/` whose `tier: "reasoned"`.

## Problem

Static probes can detect that a file exists (`ARCHITECTURE.md`, `README.md`,
`specs/`). They can't tell whether the file is useful. A stub
`ARCHITECTURE.md` scores the same as a thoughtful one; a `README.md` that
says "TODO: write me" passes `docs.readme-present`. For repofit to measure
agent-friendliness honestly, some probes have to read substance, not just
presence — and that means a language model.

## Who it's for

Probe authors who want to score the *quality* of a document or a small,
structured body of evidence — readme clarity, ADR rationale, spec
completeness, error message actionability, dev-loop bootability. Not for
detecting presence (which stays cheap and deterministic), not for scoring
large diffs (which is a separate problem).

## Design

### Probe shape

A reasoned probe is just a `defineProbe(...)` with `tier: "reasoned"`, the
`"judge"` capability declared in `evidence`, and a `detect()` that calls
`ev.judge.score({...})`:

```ts
return { kind: "judge", score, perCriterion, rationale, model };
```

The probe is responsible for assembling the **input** (a string the judge
will read) and a **rubric** (criteria the judge scores against). The
runtime handles the model call, retries, parsing, and caching.

### Rubric

A rubric is `{ task, criteria }` where each criterion has an `id` and a
`description` explaining what scores high vs. low. The judge returns a
score per criterion plus an overall score and a one-paragraph rationale.

### Caching

Results are cached on disk by `(probeId, probeVersion, sha256(input),
model)`. Bumping `PROBE_VERSION` invalidates the probe's cache; changing
the input (e.g., README contents) re-hashes. Cache lives under `.repofit/`
(gitignored). Cached runs are free and instant.

### Opt-in

Reasoned probes are opt-in via `--include reasoned` on the CLI. Default
runs stay free and deterministic. CI users who don't want to pay the LLM
bill can ignore reasoned probes entirely — they just produce no score,
not an error.

### Provider

The judge subsystem accepts either the Anthropic SDK with `ANTHROPIC_API_KEY`
or a local `claude` CLI subprocess. Each judge call is one Messages-API
request with adaptive thinking and a deterministic JSON output schema.

### Reporting

The HTML reporter renders each reasoned probe as a collapsed `<details>`
section. Expanded, it shows the per-criterion bars and the judge's
rationale verbatim. The terminal reporter shows the numeric score.

## Acceptance criteria

1. **Probe SDK** — `defineProbe` accepts `tier: "reasoned"` and a
   `"judge"` capability in `evidence`; the `detect()` callback receives an
   `ev.judge.score(args)` helper. Type errors at probe-author time if the
   tier and capability disagree.
2. **Reading shape** — judge readings have kind `"judge"` with `score`,
   `perCriterion`, `rationale`, and `model` fields. The scorer maps the
   reading's `score` straight through to dimension aggregation.
3. **Caching** — running the same probe against the same input twice in a
   row makes one API call, not two. Bumping the probe version invalidates
   the cache.
4. **Opt-in** — `repofit check` without `--include reasoned` skips reasoned
   probes entirely (they neither call the API nor appear in the report).
   `repofit check --include reasoned` runs them.
5. **HTML report** — for each reasoned probe, the rendered HTML contains
   the score, per-criterion bars, and the rationale text. All `<details>`
   sections render collapsed by default.
6. **Provider flexibility** — works against the Anthropic SDK with an API
   key, or against a `claude` CLI subprocess when no key is set.
7. **Failure behaviour** — if the model errors or returns malformed JSON,
   the probe surfaces an `"error"` reading, not a crashed run; other
   probes continue.

## Out of scope

- Scoring large diffs or whole codebases — input size is bounded per
  probe (typically ≤20K chars).
- Multi-turn reasoning — each judge call is one round-trip.
- Cross-probe judgments — every reasoned probe is independent.

## Non-goals

- Replacing static probes. Presence checks stay cheap; quality checks
  layer on top.
- Determinism. Two runs with the same input will return very close but
  not necessarily identical scores; that's why we cache results rather
  than re-derive them.
