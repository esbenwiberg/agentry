# primer — design notes

> **Status:** design-in-flight. This is a successor architecture to agentry,
> captured during a design conversation. Sections marked **Status: agreed**
> are converged; **Status: open** need decisions before implementation.
>
> No code has been written against this design yet. This document is the
> durable memory of the conversation; update as decisions converge.

---

## 1. What primer is

A thin CLI that measures and (eventually) improves a repository's *fitness for
AI coding agents* — quality, cost, latency, safety, maintainability-for-agents.
The codebase is the artifact under test; the test is *"how well will an agent
perform here, at what cost, with what quality?"*

Output is a verdict + evidence, plus optional guided remediation (deferred to
v2).

**Status: agreed.**

---

## 2. What primer does / does not

### Does
- Evaluate a repo against a corpus of declarative *probes*.
- Produce evidence-backed findings tied to specific files and signals.
- Aggregate findings into named *dimensions* (quality, cost, latency, safety, …).
- Run idempotently and read-first; no writes unless explicitly invoked.
- Run deterministically: no LLM in the hot path.
- Eventually offer opt-in remediation (deferred for v1; schema slot reserved).

### Does not
- Replace the agent. It does not write features.
- Lint human code style. (That's prettier/eslint/dotnet-format territory.)
- Bundle stack-specific knowledge in the CLI itself. The CLI is dumb; probes carry the knowledge.
- Be opinionated about which agent (Claude vs others). Probes may target specific agents; the engine does not care.
- Generate prose or fabricate content. Authoring stays human-led.
- Grow verbs beyond a small core.

**Status: agreed.**

---

## 3. Three-layer architecture

1. **Engine (the CLI)** — thin. Loads probes, runs them, aggregates results,
   formats output. Knows nothing about *what* a probe checks. Stable,
   slow-moving, versioned independently.
2. **Probes (the corpus)** — the living part. Self-contained declarative
   units. Authorable externally; default corpus shipped.
3. **Evidence cache** — deterministic snapshot of the repo. Boundary that
   keeps detectors pure and lets us add caching/parallelism without touching
   probe code.

**Status: agreed.**

---

## 4. Verbs (the surface)

Three verbs total. Variations live in flags. Resist verb growth.

| Verb | Purpose |
|---|---|
| `check` | Run probes, score, verdict. Default flow. |
| `explain` | Show what a probe/dimension does, current reading, schema dump. |
| `apply` | Run a remediation. **Deferred to v2.** Schema slot reserved. |

Common flags on `check`:
- `--ci` — exit-code-gated, machine-friendly summary
- `--json` — full structured output
- `--accept` — update baseline to current scores (ratchet mode)
- `--include executed` — opt into slow tier
- `--probe <id>` — run one probe (debugging the corpus)
- `--mode absolute|ratchet` — explicit gate mode

**Status: agreed.**

---

## 5. Probes

A probe is a declarative unit that takes evidence and emits a *reading*.
Probes do not say "pass" or "fail" — they produce typed measurements.
Interpretation is a separate stage.

### Fields
- **id** + **version** (semver; renames are new ids; id is permanent)
- **dimension(s)** it contributes to
- **tier** (static / derived / historical / executed)
- **evidence requirements** — declared, satisfied once, shared
- **detector** — pure function: evidence → reading
- **scorer** — declarative scoring config (reading → 0–100)
- **remediation** — schema slot (parsed in v1, executed in v2)
- **rationale** — markdown; *why does an agent care?*
- **fixtures** — input evidence + expected reading + expected score

Detectors are pure: no clocks, no network, no randomness, no fs, no
child_process. Engine does not hand them filesystem or process access.

### Authoring forms
- **Declarative recipes** for the easy 60% (glob + assertion patterns).
- **TypeScript detectors** for everything else.
- Both forms ship in the same probe schema.

### Reading types
| Type | Example | Default scorer |
|---|---|---|
| Predicate | "Does CONTRIBUTING.md exist?" | true→100, false→0 (invertible) |
| Count | "Files >2k LOC" | banded |
| Magnitude | "Test suite seconds" | banded with units |
| Inventory | "Secrets, TODOs" | severity-weighted count, banded |
| Distribution | "Function length" | extract stat (p95, mean), banded |

### Three states
A reading is one of:
- **value** — scored normally
- **n/a** — probe doesn't apply (dropped from aggregation; doesn't drag score)
- **error** — probe couldn't run (surfaced, not gating by default)

Without n/a as a first-class state, irrelevant probes drag scores down and
nobody trusts the gate.

### Tiers (cost class)
- **static** — read-only file glob/parse. Fast, parallelizable, default-on.
- **derived** — uses cached parsed evidence (e.g. parsed package.json). Fast.
- **historical** — reads git log/blame. Medium, deterministic on a commit.
- **executed** — shells out (run tests, run a benchmark). Slow, opt-in only via `--include executed`.
- **reasoned** — calls an LLM for semantic judgment. Stochastic, costly, opt-in only via `--include reasoned`. See below.

**Status: agreed.**

### Reasoned tier (LLM-backed probes)

Some questions can't be answered without semantic judgment — *does this
README still match the architecture? does this CLAUDE.md actually help an
agent or is it boilerplate? do these ADRs contradict each other?* Static
probes can't see this; reasoned probes can.

**Framing**: the LLM evaluates, the engine scores. Detector calls the LLM,
parses a structured response into a typed reading (usually an Inventory),
and hands it to the deterministic scorer. Everything downstream is
unchanged.

```
evidence → [LLM call] → structured findings → deterministic scorer → score
```

**Reproducibility via caching, not determinism**:
- Cache key = `(probe_version, model_id, evidence_subset_hash)`
- Cache hit → no LLM call. Re-runs on the same commit are free.
- Cache lives under `.primer/cache/reasoned/<hash>.json`; can be committed for fully-offline CI.
- Cache misses only on actual evidence change or deliberate probe-version bump.

**Pinned for stability**: model id (full version, never `-latest`), prompt
template, temperature 0, max tokens, output JSON schema. All hashed into
the probe version. Model upgrades are explicit acts (probe-version bump →
re-baseline prompt).

**Optional self-consistency**: probe may declare `samples: 3, aggregate:
median` for higher-stakes checks. Three calls, take consensus. Costs more,
drifts less.

**Cost surfacing**: probe declares an estimated token budget per
invocation. Engine tracks actual spend and prints "this run cost ~$X".
`--budget <amount>` aborts if exceeded. `explain <probe-id>` shows the
prompt + estimated cost so authors can audit before adoption.

**Privacy**: probe declares what evidence subset it sends; engine logs it.
Project config chooses the endpoint (Anthropic / OpenAI / self-hosted /
proxy). Evidence-requirements declaration is now a privacy contract too.
No probe gets to send arbitrary repo content.

**Sandboxing extension**: detectors in the `reasoned` tier may request an
`LLMClient` capability from the engine. Only `reasoned`-tier probes get
it. No other tier can call out.

**Status: agreed (schema reserved); v1 reserves the tier and shape, v1.x implements.**

### Remediation slot (deferred impl, reserved schema)

```
remediation:
  kind: file_create | file_edit | command | guidance
  scope: <files or globs touched>
  preview: <how to render a dry-run>
  body: <kind-specific payload>
```

`guidance` is the escape hatch — a markdown blob the agent can read and act
on. This is how primer hands the agent a recipe without fabricating content
itself.

**Status: agreed (schema reserved); v2 implements the `apply` verb.**

---

## 6. Scoring

Declarative banded curves. No per-probe scoring code — that's how a corpus
rots.

```
bands:
  - { upTo: 5,  score: 100 }
  - { upTo: 20, score: 70  }
  - { upTo: 50, score: 40  }
  - { score: 0 }  # fallback
```

Direction handled via `direction: positive|negative` (or band order).
Bands are easy to tighten, easy to diff in PRs, no sigmoids or magic.

**Status: agreed.**

---

## 7. Aggregation

Two levels:

- **Probe → Dimension** — weighted average. Each dimension is a declarative
  recipe of `{probe_id, weight}`.
- **Dimension → Overall fitness** — weighted average. Optional **gating
  dimensions** can cap overall (e.g. Safety < 50 → overall capped at 50).
  Stops "we got 90 overall but secrets are leaking."

Both recipes are data files, shippable, overridable per-project.
The same probe can feed multiple dimensions without duplication.

**Status: agreed.**

---

## 8. Three config layers

1. **Probe definition** — ships with the corpus. Scoring rules, recommended thresholds, rationale.
2. **Dimension recipe** — ships with the corpus. Default weights.
3. **Project config** (`primer.config.json`) — owns the gate. Threshold values, weight overrides, disabled probes, waivers.

Probe's recommended threshold = advice. Project's threshold = law.
This seam is what lets the corpus evolve without breaking everyone's CI.

**Status: agreed.**

---

## 9. Path from relaxed to tight CI

Two modes from day one:

- **Absolute** — `fitness >= threshold`. Eventual goal.
- **Ratchet** — `fitness >= baseline` per dimension (not just overall). PRs may not regress. Raise baseline via `primer check --accept`.

`primer-baseline.json` (committed) is the only stateful artifact beyond
config.

Pin the **corpus version** in project config. Upgrading the corpus is an
explicit act, like upgrading ESLint.

**Status: agreed.**

---

## 10. Score stability discipline

To make scoring trustworthy over time:

- Probe **id is permanent**. Renames are new ids.
- Probe **score-affecting changes bump the version**. Engine warns when corpus version differs from baseline.
- Probes ship with **fixtures** — input evidence + expected reading + expected score. CI on the corpus itself catches accidental score drift.

**Status: agreed.**

---

## 11. Engine pipeline

```
config + corpus → evidence → readings → scores → dimensions → verdict → report
                  (cached)    (per probe)         (aggregated)
```

| Stage | Responsibility |
|---|---|
| Loader | Resolve project config, corpus (with versions pinned), baseline |
| Evidence builder | Run requested subsystems once; cache by `(commit_sha, subsystem_versions)` |
| Runner | Schedule probes by tier; parallel within tier; isolate failures |
| Scorer | Apply per-probe scoring config; honor n/a and error |
| Aggregator | Probe scores → dimension scores → fitness; apply waivers; honor gating |
| Verdict | Compare to absolute/ratchet policy |
| Reporter | Format: human (default), JSON, SARIF (reserved for v1.x) |

Each stage is a pure function on data; replaceable; testable.
A run is `(config, corpus_version, commit_sha) → verdict`. Pure.

**Status: agreed.**

---

## 12. Exit codes

- `0` — pass
- `1` — fitness gate failed (legitimate fail)
- `2` — engine error (corpus broken, evidence couldn't build, config invalid)

CI must distinguish "your repo regressed" from "the tool is broken."

**Status: agreed.**

---

## 13. Cache layout

```
<repo>/.primer/                  # gitignored
  cache/
    evidence-<sha>-<subsys>.json
    readings-<sha>-<corpus>.json
primer.config.json               # checked in (the policy)
primer-baseline.json             # checked in (the gate, ratchet mode)
```

Baseline and config are committed; everything else is throwaway.

**Status: agreed.**

---

## 14. Sandboxing model

- Probes are trusted code (corpus is an explicitly installed dependency).
- Detector signature: `(evidence) => reading`. No fs, no network, no child_process in scope.
- Engine does not hand probes filesystem or process access.
- Linting/typing on the corpus rejects forbidden imports.

Not a security boundary against malicious corpus authors — that's the same
problem as any npm dependency.

**Status: agreed.**

---

## 15. Configuration formats

- **Project config**: JSON. Universally readable. Plain users edit it directly; advanced users generate it.
- **Corpus authoring**: TypeScript. Real code, typed plugin contract; declarative subset for simple probes.

Two formats, two audiences, no overlap.

**Status: agreed.**

---

## 16. Evidence subsystems

Pluggable. Probes declare what they need; gatherers run once per subsystem
per commit and cache. Adding a language = ship a corpus package with
gatherers + probes.

### v1 minimum set
`files`, `git`, `gitignore`, `node_package`, `tsconfig`, `nuget`,
`dotnet_solution`, `agent_config`, `doc_index`, `adr_index`.

Covers TS and .NET out of the box, plus the agent-specific signals
(`agent_config`, `doc_index`, `adr_index` carry the highest signal for the
agent-fitness use case).

### Universal (apply to any repo)
`files`, `git`, `gitignore`, `license`, `doc_index`, `adr_index`,
`agent_config`, `ci_workflows`, `editor_config`, `commit_history`,
`size_stats`, `repo_meta`.

### Per-ecosystem
`node_package`, `tsconfig`, `nuget`, `dotnet_solution`, `python_package`,
`rust_cargo`, `go_module`, `java_build`, `ruby_bundler`.

### Composite / cross-ecosystem
`test_runner`, `lint_config`, `build_targets`, `runtime_targets`,
`secrets_indicators`.

### External (executed tier, opt-in)
`dependency_advisories`, `branch_protection`, `issue_tracker`.

**Status: agreed for v1 set; further subsystems added incrementally.**

---

## 17. Repo layout

Monorepo, two packages from day one, strict boundaries:

```
packages/
  engine/          — the CLI
  corpus-default/  — the bundled probe set
```

- Independent semver per package.
- Engine tests do not import corpus internals; corpus tests do not import engine internals.
- Plugin contract enforced by module boundaries (not vibes).
- Split into separate repos when the API stabilizes (post-1.0).

Reasons we'd eventually split:
- Release coupling — corpus iterates faster than engine post-stabilization.
- Contributor scope — "contribute a Rust corpus" is a smaller ask against a corpus repo.
- Permissions / maintainership — corpus contributors don't need engine commit rights.
- Issue noise.
- Dependency hygiene — separate forces the contract.

**Status: agreed (monorepo until post-1.0).**

---

## 18. Open questions

- Default dimension list — **next discussion topic**.
- SARIF reporter — v1.x or later? (currently: reserved slot, not v1)
- Final `primer.config.json` schema — settle once dimensions are concrete.
- License for the project.
- Initial CI surface — which checks gate primer's own development?
- Plugin distribution — npm by default; do we want a registry index later?

> Probe schema concretized in `probe-schema.md`. Locked decisions: weight
> precedence (probe → dimension → project), detectors always async,
> recipe library ships in v1.

---

## 19. Deferred to later versions

- `apply` verb (remediation execution); schema slot reserved in v1.
- `reasoned` tier probes (LLM-backed); tier + schema + cache layout reserved in v1, implementation in v1.x.
- SARIF output.
- External-tier evidence subsystems beyond reservation.
- Custom reporter plugin contract.
- Splitting engine and default corpus into separate repos.

---

## Glossary

- **Probe** — declarative unit that takes evidence and emits a reading.
- **Reading** — typed result of a probe (predicate, count, magnitude, inventory, distribution); or n/a; or error.
- **Dimension** — named axis (quality, cost, …) aggregated from weighted probe scores.
- **Fitness** — overall score, weighted aggregate of dimensions.
- **Corpus** — versioned package of probes + dimensions + recipes.
- **Baseline** — committed snapshot of current scores; used by ratchet mode.
- **Gate** — the project's pass/fail policy (absolute or ratchet).
- **Tier** — probe cost class (static / derived / historical / executed).
- **Waiver** — project-level acceptance of a specific finding.
- **Evidence subsystem** — a typed subset of repo state (files, git, nuget, …) gathered once and shared across probes.
- **Reasoned probe** — a probe whose detector calls an LLM to produce a structured reading. Lives in the `reasoned` tier; opt-in; cached by content hash for reproducibility.
