# repofit — implementation plan

> **Status:** historical. This document sequenced the work from empty repo
> to v1.0.0; phases 0 → 7 are complete. Kept as a record of the original
> plan; current scope lives in [`docs/release/`](../release/) and ADRs
> under [`docs/adr/`](../adr/).

---

## 1. v1 definition of done

A user can:

1. `npx @esbenwiberg/repofit check` on a real repo and get a real score.
2. Run `--init` to commit `repofit.config.json`.
3. Run `--accept` to commit `repofit-baseline.json`.
4. Add `repofit check --ci` to GitHub Actions and have PRs gated.
5. Read clear human reports and consume the JSON for tooling.
6. See clean rationale via `repofit explain <probe>`.

v1 shipped:
- The engine package.
- The default corpus package (58 probes across six dimensions).
- TypeScript SDK (`defineProbe`, `defineDimension`, recipes).
- Documentation enough to onboard.
- The `apply` verb (remediation execution) — *shipped ahead of plan.*
- The `reasoned` tier with Anthropic / OpenAI / Codex transports — *shipped ahead of plan.*
- SARIF, HTML, and Markdown reporters in addition to human / json / ci — *shipped ahead of plan.*

v1 did **not** ship:
- Reporter plugin contract (built-in reporters only).
- JSON schemas for `repofit.config.json` / `repofit-baseline.json`.
- Anything else marked deferred across the design docs.

**Status: shipped.**

---

## 2. Repo layout (finalized)

Monorepo, two packages from day one, strict boundaries.

```
repofit/
├── packages/
│   ├── engine/                       # @esbenwiberg/repofit — the CLI + runtime
│   │   ├── src/
│   │   │   ├── cli/                  # commander/yargs/etc entrypoints
│   │   │   ├── loader/               # config + corpus + baseline loaders
│   │   │   ├── evidence/             # subsystem registry + gatherers
│   │   │   ├── runner/               # tier scheduler, probe execution
│   │   │   ├── scorer/               # reading → score
│   │   │   ├── aggregator/           # probe → dim → fitness
│   │   │   ├── verdict/              # ratchet/absolute/advisory
│   │   │   ├── reporters/            # human, json, ci
│   │   │   └── sdk/                  # public API: defineProbe, defineDimension, recipes, types
│   │   ├── test/
│   │   └── package.json
│   └── corpus-default/               # @esbenwiberg/corpus-default — the bundled probes
│       ├── src/
│       │   ├── probes/               # one file per probe
│       │   ├── dimensions/           # six dimension recipes
│       │   └── index.ts              # exports all probes + dimensions
│       ├── test/
│       └── package.json
├── docs/
│   └── design/                       # this folder (already exists)
├── .github/workflows/                # CI
├── package.json                      # npm workspaces root
├── tsconfig.base.json
├── biome.json                        # or eslint+prettier
├── LICENSE
└── README.md
```

**Status: agreed.**

---

## 3. Tech stack

- **Node**: 22.x (LTS). `engines.node` enforced.
- **TypeScript**: strict, ESM, NodeNext resolution. Same posture as existing agentry repo.
- **Test runner**: **vitest** — fast, ESM-native, good fixture support, similar API to jest.
- **Linter**: **biome** — single-tool linter + formatter, fast, good defaults.
- **Workspace**: npm workspaces (no pnpm/yarn dependency).
- **CLI parsing**: **commander** — battle-tested, small, ESM-friendly.
- **License**: **MIT**.
- **npm scope**: **`@esbenwiberg`** — packages publish as `@esbenwiberg/repofit` and `@esbenwiberg/corpus-default`.

**Status: agreed.**

---

## 4. Phases

Each phase is a vertical slice. End-of-phase = something demoable + committed.

### Phase 0 — Skeleton (1–2 days)

- Workspace + two packages with empty `package.json`.
- TS config (base + per-package).
- Biome (or eslint+prettier) wired.
- Vitest wired with one trivial test per package.
- License + README skeleton + gitignore.
- CLI entrypoint that prints `repofit 0.0.0`.
- CI workflow: install → typecheck → lint → test on push and PR.

**Demoable**: `npx repofit --version` prints something. CI is green.

### Phase 1 — Engine core, one probe, read-only (3–5 days)

- Type definitions: `Reading`, `ScoreConfig`, `Probe`, `Dimension`, `EvidenceSubsystem`, etc.
- Evidence registry + one subsystem: `files` (with `agent_config` adjacent — both shipped, since `agent.guidance-present` needs `agent_config`).
- Loader for project config (skeleton; can be missing).
- Loader for corpus package (resolve from `node_modules`).
- Sequential runner.
- Predicate scorer.
- Basic aggregator.
- Human reporter (minimal — score per dim + verdict).
- One probe in `corpus-default`: `agent.guidance-present` via `defineProbe`.
- `--probe <id>` flag for targeted runs.

**Demoable**: `repofit check` against this very repo returns a real number based on whether `CLAUDE.md` exists.

### Phase 2 — Schema completeness (4–6 days)

- Remaining reading types: count, magnitude, inventory, distribution.
- All scoring shapes (banded, severity-weighted, distribution-stat).
- `na` and `error` handling end-to-end.
- Tiered scheduler (static / derived / historical); parallelism within tier.
- Fixture runner: every probe's declared fixtures are tested in CI.
- Recipe library v1: `fileExists`, `fileAbsent`, `globCount`, `jsonValueEquals`, `fileSizeDistribution`.
- 10–12 probes shipped across dimensions to exercise every reading type and tier.
- Evidence subsystems added as probes need them: `git`, `gitignore`, `node_package`, `tsconfig`, `nuget`, `dotnet_solution`.

**Demoable**: `repofit check` against this repo produces a multi-dimension score from a representative subset of probes.

### Phase 3 — Config + baseline + bootstrap (3–4 days)

- `repofit.config.json` loader + validator (JSON schema published in the engine).
- `repofit-baseline.json` reader/writer.
- `--init` flag (writes config with current corpus version pinned).
- `--accept` flag (writes baseline; requires clean tree by default).
- Gate modes: ratchet, absolute, advisory.
- Per-dimension thresholds; gating dimensions with cap behavior.
- Waivers (probeId + location).
- Probe-specific knob validation against probe-declared schema.
- Drift handling (new/removed probes, corpus version mismatch).

**Demoable**: bootstrap flow end-to-end on a real repo.

### Phase 4 — Full v1 corpus + reports (4–6 days)

- Remaining always-on probes to reach 26.
- Evidence subsystems: `commit_history`, `editor_config`, `ci_workflows`, `doc_index`, `adr_index`, `agent_config` (complete), `secrets_scan` (wrapping secretlint), `size_stats`.
- JSON reporter (versioned schema).
- CI reporter + GitHub Actions annotations.
- `explain` verb (probe and dimension).
- Cache layer (evidence + readings) keyed by `(commit_sha, corpus_versions, subsystem_versions)`.

**Demoable**: full default-corpus run, all output modes, explain working.

### Phase 5 — Opt-in tiers (3–4 days)

- `executed` tier: 4 latency probes + 3 `clean` companion probes (lint.clean, format.clean, types.clean).
- Warmup (run-twice, report-second).
- External-tier reservation in schema; one stub implementation (branch protection via GitHub API) to prove the contract.
- `--include executed` flag respected.
- Cost surfacing for the `executed` tier (wall-clock totals in the report).

**Demoable**: `repofit check --include executed` runs the slow stuff.

### Phase 6 — Dogfood (2–3 days)

- Run `repofit check` against repofit's own repo.
- Fix or waive findings; commit baseline.
- CI gates repofit with repofit (in addition to typecheck/lint/test).
- This phase exercises the bootstrap flow and surfaces any UX papercuts.

**Demoable**: repofit's CI shows a fitness score and gates the PR.

### Phase 7 — Release (2–3 days)

- README finalized with quickstart.
- Migration note for any agentry users (if relevant).
- Version both packages 1.0.0.
- npm publish under chosen scope.
- GitHub release with changelog.

**Demoable**: `npx @esbenwiberg/repofit check` works for any user.

**Status: phases agreed in shape; estimates are rough.**

---

## 5. Critical-path dependencies

- Phase 1 unblocks everything else.
- Phase 2 (reading types) unblocks the full corpus in Phase 4.
- Phase 3 (config + baseline) unblocks dogfood in Phase 6.
- Phase 5 (opt-in tiers) is the only phase that's optional for a "soft v1" — could ship core v1 without it and add v1.1.

**Status: agreed.**

---

## 6. What goes in the engine CI

Two surfaces:

**Standard developer-experience CI** (Phases 0+):
- `typecheck` (tsc --noEmit on both packages)
- `lint` (biome / eslint check)
- `test` (vitest run, including corpus fixtures)
- `build` (compile both packages)

**Self-dogfood CI** (Phase 6+):
- `repofit check --ci` against the repo.
- Gates PRs in ratchet mode initially; graduates to absolute later.

**Status: agreed.**

---

## 7. Decisions deferred until Phase 0 starts

These are coding-time decisions, not design decisions. Listed so they're not forgotten:

- **Commit / changelog discipline** — likely mirror existing agentry conventions (`type(scope): subject` + `.changes/` fragments).
- **README structure** — quickstart, badge, screenshot of `repofit check` output.

---

## 8. Open questions

1. **Phase estimates** — rough; the only critical bit is the *order*. Time-boxing per phase happens once we start.

---

## 9. After v1 — the natural v1.x roadmap

These are already-designed features waiting for v1 to ship:

- `reasoned` tier implementation (LLM-backed probes + claude-code provider transport).
- `apply` verb (remediation execution).
- SARIF reporter.
- Finding-hash-based waivers.
- Per-probe severity promotion in dimension overrides.
- Additional language corpus packages (Python, Rust, Go, Java).
- Reporter plugin contract.
- `repofit corpus upgrade` command.

Sequence and prioritization within v1.x is a separate conversation once v1 is shipping.

**Status: roadmap, not commitment.**

---

## Glossary additions

- **Phase** — vertical slice ending in a demoable + committed state.
- **Dogfood** — running repofit against repofit's own repo to surface UX issues.
- **Soft v1** — ships without Phase 5 (opt-in tiers); usable but no latency/clean probes.
