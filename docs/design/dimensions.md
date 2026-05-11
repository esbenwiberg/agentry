# primer — default dimensions

> **Status:** agreed. Companion to `primer.md` (architecture) and
> `probe-schema.md` (authoring contract).

---

## 1. Mental model

Six dimensions in four buckets, each answering a natural question about
agent fitness:

| Bucket | Question | Dimension(s) |
|---|---|---|
| Substrate | *Can the agent operate?* | **Context**, **Feedback** |
| Output | *Does its work fit?* | **Consistency** |
| Economics | *Can we afford it?* | **Cost**, **Latency** |
| Risk | *Can we trust it?* | **Safety** |

**Status: agreed (bucketing is conceptual; not part of the runtime).**

---

## 2. The six dimensions

| Dimension | Answers | Gating | Default weight |
|---|---|---|---|
| **Context** | Can the agent understand this repo on first read? | no | 25% |
| **Feedback** | Can the agent verify its own changes? | no | 20% |
| **Consistency** | Will the agent's output blend in? | no | 15% |
| **Cost** | How many tokens per task here? | no | 15% |
| **Latency** | How long per agent cycle? | no | 10% |
| **Safety** | What's the blast radius of a mistake? | **yes** | 15% |

Weights sum to 100%. They are an opinionated *starting point*, not law.
The weight table itself ships as a dimension recipe in the default
corpus — one PR away from adjustment.

**Status: agreed.**

---

## 3. Per-dimension scope

### Context (25%)
*Can the agent understand this repo on first read?*

Probes target the materials an agent reads before doing anything: project
guidance, architectural decisions, per-module docs, and whether any of
the above are stale.

Example probes:
- `agent.claude-md-present` (predicate)
- `agent.readme-substance` (count of substantive sections)
- `agent.adr-index-populated` (count of ADRs)
- `agent.contributing-md-present` (predicate)
- `agent.module-readme-coverage` (magnitude: % of top-level dirs with READMEs)
- `agent.guidance-not-stale` (reasoned, v1.x — does CLAUDE.md still match the codebase)

### Feedback (20%)
*Can the agent verify its own changes?*

Probes target the verification loop: tests, types, linters, formatters,
CI gates, pre-commit hooks. Without feedback the agent ships unverified
work.

Example probes:
- `agent.test-runner-configured` (predicate; cross-ecosystem)
- `agent.linter-configured` (predicate; cross-ecosystem)
- `agent.formatter-configured` (predicate)
- `agent.typecheck-configured` (predicate; if applicable)
- `agent.ci-runs-tests` (predicate)
- `agent.precommit-hooks-present` (predicate)

### Consistency (15%)
*Will the agent's output blend in with what's already there?*

Probes target convention conformance: commit messages, formatter
cleanliness, lint cleanliness, gitignore comprehensiveness.

Example probes:
- `agent.conventional-commits-followed` (magnitude: % of last N commits)
- `agent.formatter-clean` (predicate: codebase matches its own formatter)
- `agent.linter-clean` (predicate: codebase matches its own linter)
- `agent.editorconfig-present` (predicate)
- `agent.changelog-strategy-declared` (predicate)
- `agent.gitignore-comprehensive` (predicate: covers common patterns)

### Cost (15%)
*How many tokens per task here?*

Probes target context-load efficiency: repo size, file sizes, function
sizes, directory depth, boilerplate ratio. A bloated repo costs more
per agent task forever.

Example probes:
- `agent.repo-token-budget` (magnitude: estimated tokens to summarize repo)
- `agent.large-files-count` (count: files exceeding a LOC/byte threshold)
- `agent.giant-functions` (count: functions over a LOC threshold)
- `agent.directory-depth` (distribution: nesting depth across the tree)
- `agent.boilerplate-ratio` (magnitude: detected boilerplate / total)

### Latency (10%)
*How long per agent cycle?*

Probes target wall-clock of the verification loop. All `executed` tier —
opt-in, never default. A slow test suite is a slow agent.

Example probes (all `tier: executed`):
- `agent.test-latency` (magnitude: seconds)
- `agent.build-latency` (magnitude: seconds)
- `agent.lint-latency` (magnitude: seconds)
- `agent.typecheck-latency` (magnitude: seconds)

### Safety (15%) — **gating**
*What's the blast radius of an agent mistake?*

Probes target what can go wrong if the agent makes a bad call: tracked
secrets, missing branch protection, unguarded destructive scripts,
absence of pre-commit checks.

Example probes:
- `agent.dotenv-gitignored` (predicate)
- `agent.tracked-secret-indicators` (inventory; severity-weighted)
- `agent.precommit-secret-scan` (predicate)
- `agent.dangerous-script-flagging` (inventory)
- `agent.branch-protection` (predicate; `external` tier, opt-in)
- `agent.code-review-required` (predicate; `external` tier, opt-in)

**Status: probe lists are illustrative — concrete corpus is the next design topic.**

---

## 4. Why Safety is the only gating dimension in v1

Gating dimensions cap the overall score. Safety qualifies because "we
scored 88 overall but `.env` is tracked" is a misleading number — the
high score implies trust we haven't earned.

Other dimensions don't have that property: a repo with no docs but
excellent tests can legitimately score in the middle without misleading
anyone.

Promotion path for v1.x: if real-world usage shows overall scores
misleading users when Feedback is collapsing, promote Feedback to
gating. Start narrow.

**Status: agreed.**

---

## 5. Direction at the report layer

All dimensions report *higher = better*. Probes underneath can be either
direction; the scorer normalizes. This keeps the report uniform: "Context
72 / Safety 90" reads the same way every time.

**Status: agreed.**

---

## 6. Sizing expectation

If each dimension holds 5–8 probes in v1, the default corpus ships
~30–45 probes total. Working tool, not a toy, but small enough to
maintain.

Reasoned-tier probes count toward this budget but are off by default.

**Status: agreed (target, not a hard cap).**

---

## 7. Deferred to later versions

- **Per-ecosystem dimension recipes** — e.g. a .NET-specific Feedback recipe that re-weights probes appropriate to .NET tooling. v1.x.
- **Sub-dimensions / hierarchical aggregation** — keep flat in v1; revisit if probe counts per dimension exceed ~15.
- **Reasoned-tier probes** — appear in dimension lists from v1.x onward; v1 dimensions can already reference them but they won't run.

---

## Glossary additions

- **Gating dimension** — a dimension whose score can cap the overall fitness score. Safety in v1; potentially Feedback in v1.x.
- **Dimension recipe** — declarative file that defines a dimension's metadata, gating flag, and weight overrides for probes.
