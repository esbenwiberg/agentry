# 0005 — Scan-driven core, catalog as practices, overlays as artifacts

**Status:** Accepted — dogfood validation (TeamPlanner round-trip) deferred per user direction; revisit if it surfaces issues
**Date:** 2026-05-04

## Context

ADR-0001 framed agentry as three verbs (`doctor` / `add` / `coach`) over a
curated catalog of installable templates. Two months in, dogfooding the
bundled catalog surfaced two flaws:

1. **`doctor` is mis-marketed.** What it actually does is lockfile drift
   detection on installed entries. Adopters typing `agentry doctor` expect
   a deep audit; they get a narrow file-presence check on seven kernel
   files. The verb occupies the "audit" slot without delivering
   audit-shaped value. The complaint surfaced the first time a non-author
   tried to use the CLI ("the audit feels light").
2. **The install-template model assumes universals that don't exist.**
   Commit-msg regex (conventional / gitmoji / jira-prefix), secret-scan
   tools (gitleaks / trivy / detect-secrets / truffleHog), hook runners
   (husky / lefthook / pre-commit / raw `.githooks`), CI providers (GH
   Actions / GitLab / Circle) — every "template" agentry was set up to
   ship is actually a *family of variants*. There is no canonical
   commit-msg hook; there's Acme's, Beta's, and Gamma's. Shipping one as
   bundled forces an opinion adopters won't share.

The thing that *is* universal is the **practice** — "use a structured
commit format; here's how to choose; here's what good looks like." The
artifact-level uniformity teams want is **team-local**, not
agentry-global. ADR-0004 introduced overlays as a plugin model; this ADR
resolves what they're *for*.

A scan + LLM loop is the missing top-of-funnel: deterministic evidence
collection, then a brief that hands the agent the right practices for the
gaps it found. Re-scan verifies the work landed. The agent does the
per-repo authoring; agentry teaches it what to do and verifies the
result.

## Decision

Pivot the product around three concentric layers and a scan loop.

### 1. Three layers of opinion (universal → team → instance)

| Layer | Owns | Form |
|---|---|---|
| **Bundled catalog** | Universal practices for agentic readiness | Markdown reference docs only — *no artifacts* |
| **Overlays** | Team-canonical artifacts + team-specific practice overrides | Byte-perfect files (`commits-conventional.sh`, team `gitleaks.toml`, etc.) |
| **Scan + brief + LLM** | Per-repo tailoring | Generated files written by the adopter's agent |

The bundled catalog stops shipping installable templates. Every bundled
entry becomes a practice doc — guidance the LLM reads, not text it
copies. Anything that *must* be byte-perfect for a team's repos lives in
an overlay that team controls.

### 2. Scan as the new top of funnel

```
agentry scan        → deterministic evidence bundle (always)
agentry brief       → emit prompt + bundle + relevant practices/artifacts
                       for the agent (the agent does the work)
agentry scan again  → verify the fix landed (re-scan is the truth)
```

`scan` collects, into `.agentry/scan/<timestamp>/` (gitignored):

- Stack & shape (languages, manifests, build systems, frameworks, monorepo signals)
- Git & collaboration (commit-message sample, contributors, hot files via
  `git log --name-only`, PR samples via `gh` if available)
- Hygiene checklist (LICENSE, README structure, CI presence + coverage,
  linter/formatter configs, type-checker setup, test:source ratio)
- Security smell-test (committed secrets via regex, lockfile age, audit
  results via `npm audit` / `pip-audit` / `cargo audit` if installed)
- Agent-readiness inventory (existing `.claude/`, `CLAUDE.md`,
  `AGENTS.md`, `.cursorrules`, ADRs, `specs/`, `PRACTICES.md`, etc.) with
  *staleness* signal (file untouched while code churned)
- Doc archaeology (README first 200 lines, ADR titles + status, existing
  CLAUDE.md verbatim, root-level markdown headings)
- **Fitness tests (default-on, opt-out via `--no-fitness`).** Build,
  test, typecheck, lint, format-check. Captured pass/fail + duration +
  output excerpt. Documented prominently as "this runs your code."

`brief` writes an `instructions.md` that points the agent at:
- The scan bundle.
- A snapshot of the merged catalog (so the LLM can't hallucinate ids).
- Registered overlays' artifacts (so the LLM can drop verbatim where
  teams want byte-perfect uniformity).

The agent reads the brief and produces a diagnosis, a shopping list of
`agentry add <id>` commands (overlay artifacts), and authored prose
(CLAUDE.md, ADRs, etc.) tailored to the repo.

### 3. Verbs after the pivot

| Verb | Status |
|---|---|
| `agentry scan` | NEW — top-of-funnel evidence + verification |
| `agentry brief` | NEW — emits prompt for the agent |
| `agentry list` | Kept — browses practices + overlay artifacts |
| `agentry add <id>` | Kept, narrowed — primarily overlay artifacts (verbatim drops). Bundled entries become practices the LLM authors against, not templates that get installed |
| `agentry upgrade [--check]` | Kept — refreshes installed artifacts; `--check` becomes the CI gate that doctor used to be |
| `agentry remove <id>` | Kept |
| `agentry coach <kind>` | Kept, smaller — manual entry to author bespoke prose without running the full scan loop |
| `agentry doctor` | **Removed.** Lockfile drift check folds into `upgrade --check`. The verb was misleading and squatted on the audit slot scan now occupies |

### 4. Catalog content migration

Today's bundled catalog ships templates: `commits`, `changelog`,
`code-review`, `pull-requests`, `git-hooks`, `ship`. Under this ADR they
migrate from "installable templates" to "practice docs":

- `commits.md` → practice on commit conventions (covers conventional /
  gitmoji / jira-prefix variants, when each fits, how to enforce).
- `git-hooks.md` → practice on hook strategies (husky vs lefthook vs raw
  `.githooks`, tradeoffs, security considerations).
- `code-review.md` → guidance on review prompt patterns.
- `changelog.md` → guidance on fragment-based vs generated changelog
  flows; the **scripts** that today's `changelog` entry installs migrate
  out of bundled and into a default `team-defaults` overlay (or stay out
  entirely if the practice doc is enough).
- `pull-requests.md`, `ship.md` → guidance docs.

Adopters who want byte-perfect canonical artifacts (Acme: "all 30
services use this exact regex") publish an overlay containing them. The
bundled catalog ships zero artifacts post-migration.

### 5. Overlay role expansion

ADR-0004 introduced overlays for "stack-specific bundles"
(`@stack/dotnet`). This ADR expands their role: **overlays are also where
team-canonical artifacts live.** Same mechanism, broader use case. No
protocol change; ADR-0004's manifest, registration, lockfile semantics,
and trust surface all carry forward unchanged.

A team adopting agentry across N repos publishes one overlay containing
their commit-msg hook, secret-scan config, CI templates, etc. Each repo
registers the overlay; `agentry add commits-conventional` from that
overlay drops the team's exact regex. Cross-repo standards survive
through overlay versioning + `agentry upgrade`.

### 6. ADR-0001 amendment

ADR-0001's verb table (`doctor` / `add` / `coach`) is superseded for the
audit verb. The "doctor reads, add writes opt-in, coach never writes"
posture survives but with `scan` as the new read-only entry point. A
small surface migration: `coach` shrinks (most coach paths flow through
the scan→brief loop), `add` narrows (overlay-artifact focus), `upgrade`
absorbs the drift-check job. ADR-0001's status will be amended to mark
this supersession.

## Consequences

**Easier:**

- Tool-agnostic survives cleanly. Bundled catalog is markdown only — no
  language assumptions baked in.
- Cross-team variance stops being agentry's problem. Teams enforce
  uniformity via overlays; agentry enforces nothing across teams.
- The pitch sharpens: *"agentry teaches your agent best-practices for
  agentic readiness; the agent writes tailored files; re-scan verifies."*
- The bundled catalog becomes maintainable solo — practice docs are
  easier to keep current than tested templates with semver semantics.
- Phase 5 (TeamPlanner round-trip) validates against the new model
  rather than the old one. TeamPlanner's existing `.claude/` migrates
  via scan + LLM rather than being rewritten by hand into install
  templates.
- Goodhart risk is reduced compared to a closed-loop "LLM optimizes
  against scan rules" — the brief explicitly distinguishes practices
  (judgment-laden) from artifacts (mechanical), and re-scan only
  asserts structural completion, not quality. Quality stays the
  human/agent's responsibility.

**Harder / accepted trade-offs:**

- Solo developers / small teams without overlays accept that
  LLM-authored artifacts will vary slightly per repo. Coordination
  across N repos is what overlays are for; without them, expect drift.
- The "LLM authors most of the work" model requires an LLM. Agentry is
  no longer fully useful without one — `scan` produces evidence with no
  fixer. Mitigated by the bundle being usable as documentation even
  without an agent, but the loop closes only when an agent runs the
  brief.
- Existing adopters of bundled `commits` / `git-hooks` / etc. templates
  lose the verbatim install path. Migration: those entries become
  practice docs; teams that want the old templates create a
  `team-defaults` overlay (or vendor the scripts directly).
- `agentry doctor` users must rewire to `agentry upgrade --check`
  (script change). Kill is breaking; ADR-0001 explicitly named doctor
  as a pillar.
- Fitness tests default-on means `agentry scan` executes user code
  (build/test/etc.). This is documented prominently and gated behind
  `--no-fitness` for sandboxed or untrusted contexts. The brief warns
  the agent when fitness was skipped so it doesn't misread "no signal"
  as "all good."
- Test surface for verbs shifts. The current 119 tests over
  list/doctor/add/upgrade/remove/coach become list/scan/brief/add/
  upgrade/remove/coach + scan-bundle-shape tests + brief-output-shape
  tests. Doctor tests are deleted; their drift-detection coverage moves
  to upgrade-check tests.

**Guardrails:**

- The bundled catalog must contain zero artifacts. Reviewers of any
  catalog PR enforce: practice docs only. If something feels
  artifact-shaped, it goes in an overlay (or stays out).
- The brief must always include a catalog snapshot so the LLM cannot
  hallucinate ids.
- Re-scan is the truth. A "green scan" is the verification contract.
  We do not add separate "verify" verbs — scan already does it.
- This ADR was originally written as **Proposed**, gated on a thin
  vertical slice of `scan` + `brief` validated against a real repo
  before migration. That gate was lifted by explicit user direction:
  ship the whole pivot (scan + brief + catalog migration + doctor
  removal) and dogfood last. The ADR is therefore **Accepted**, with
  the TeamPlanner round-trip deferred to a final validation pass. If
  the round-trip surfaces structural problems, this ADR will be amended
  rather than reverted.
- Privacy: scan default is metadata-only (no source-file contents in
  the bundle beyond manifests, configs, README, CLAUDE.md, ADRs).
  `--include-source` is opt-in and prints a clear notice.

## Alternatives considered

- **Status quo (keep ADR-0001 as-is).** Rejected — the install-template
  model doesn't survive cross-team artifact variance, and `doctor` will
  keep occupying the audit slot without delivering audit value.

- **Doctor as parent verb (`doctor scan` / `doctor analyze`).**
  Rejected — asymmetric with the rest of the verb taxonomy (every other
  verb is single-word) and forces a "what does bare `doctor` do?"
  question with no clean answer. Also keeps the misleading verb name.

- **Doctor stays, scan added alongside, both top-level.** Rejected —
  two verbs occupying overlapping audit territory invites confusion.
  The cleaner cut is one audit verb (`scan`); drift-check folds into
  `upgrade --check` where it actually belongs.

- **Pure LLM-fix model (kill the catalog entirely).** Rejected — every
  repo gets LLM-improvised artifacts with no shared baseline; cross-repo
  standards become impossible; LLMs hallucinate plausible-but-wrong
  hooks (commit-msg regex, secret patterns) with silent failure modes.
  Bundled practices act as the agent's vocabulary; team overlays act as
  canonical artifacts. Both have load-bearing roles.

- **Keep templates in bundled catalog with multi-variant entries
  (`commits-conventional`, `commits-gitmoji`, `commits-jira`).**
  Rejected — variant explosion is unbounded (every team has tweaks) and
  forces agentry to maintain N variants of every artifact. Overlays let
  teams own their variant; bundled stays universal.

- **Bundled artifacts with `${VARIABLE}` substitution.** Rejected —
  ADR-0002 already locked "no template substitution at install time."
  Reopening that decision creates a templating language with all the
  maintenance that implies.

- **Scan dumps to `/tmp` instead of `.agentry/scan/<ts>/`.** Rejected —
  saved scans enable scan-over-time comparison ("did our agentic
  readiness improve since last month?"), which is its own value.
  Gitignored by default; users can prune at will.

- **Fitness tests opt-in.** Rejected (per explicit user direction
  during ADR drafting) — agentic readiness is the goal, not speed.
  Tests run by default; `--no-fitness` opts out for sandboxed or
  untrusted contexts. The `--no-fitness` warning is loud enough that
  CI / hostile-repo cases don't silently misread the bundle.

- **Rename `brief` to `analyze`.** Rejected — `analyze` overpromises.
  The verb does not analyze; it emits a prompt for an agent that then
  analyzes. `brief` names the actual deliverable.

- **Lock this ADR as Accepted now.** Rejected — the pivot is large and
  the validation (Phase 5 dogfood on TeamPlanner) hasn't happened.
  Locking now would repeat the mistake ADR-0001 made (committing to a
  verb taxonomy before the kernel was proven). `Proposed` until
  TeamPlanner round-trips.
