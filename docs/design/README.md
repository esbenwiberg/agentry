# repofit — design

> **Status:** design review, no code yet. Successor architecture to
> agentry, captured during a multi-session design conversation. The
> agentry codebase that currently ships is unaffected until/unless an
> ADR is opened to formally pivot.

This folder is the durable memory of the design conversation. Seven
documents, each owning one concern; cross-linked where needed.

---

## Reading order

For a first-time reader, work top to bottom — each doc assumes the
previous ones.

| # | Doc | What it locks |
|---|---|---|
| 1 | [`repofit.md`](./repofit.md) | Architecture overview. Three-layer model (engine / probes / evidence). Verbs. Tiers. Reasoned-tier framing. Remediation slot reservation. |
| 2 | [`probe-schema.md`](./probe-schema.md) | Probe authoring contract: `defineProbe()`, five reading types, scoring config shapes, declarative recipes, weight precedence, async detectors. |
| 3 | [`dimensions.md`](./dimensions.md) | The six default dimensions and their weights. Context (25%) / Feedback (20%) / Consistency (15%) / Cost (15%) / Latency (10%) / Safety (15%, gating). |
| 4 | [`corpus-v1.md`](./corpus-v1.md) | Default corpus v1: 26 always-on probes + 10 opt-in + 1 reasoned-for-v1.x. Probe IDs, naming convention, recipe-vs-custom coverage. |
| 5 | [`config-and-baseline.md`](./config-and-baseline.md) | `repofit.config.json` (the policy gate) and `repofit-baseline.json` (the ratchet snapshot). Corpus pinning, gate modes, dimension/probe overrides, waivers, bootstrap flow, `claude-code` LLM provider. |
| 6 | [`reports.md`](./reports.md) | Output formats: human (default) / `--json` / `--ci` / `repofit explain`. Visual conventions. Gating-cap rendering. GitHub Actions annotations. |
| 7 | [`implementation-plan.md`](./implementation-plan.md) | Seven-phase build sequence from skeleton to v1.0.0 release. Tech stack: Node 22, TS strict, vitest, biome, commander, MIT, npm scope `@esbenwiberg`. |

---

## Status of the design

Substantively complete for v1. The user-facing surface (verbs, config,
baseline, reports) is locked. The author-facing surface (probe schema,
recipes, dimensions) is locked. The internal engine surface (tiers,
evidence subsystems, scorers, aggregators) is locked enough to start
coding.

Genuinely open items remaining (none block Phase 0):
- SARIF reporter timing — v1.x or later? Schema slot reserved.
- Plugin distribution — npm by default; do we want a registry index?
- Reasoned-tier `claude-code` provider transport mechanism (SDK call vs IPC vs MCP) — schema slot reserved; mechanism is a v1.x implementation detail.
- Per-doc minor open items remain inside `reports.md` and others; check the relevant file's open-questions section.

---

## Relationship to agentry

repofit is framed as a **successor architecture** to agentry's
scan/brief/add/upgrade/remove/coach/list model. Where agentry manages
artifacts (overlays, practices, briefs), repofit measures fitness against
a probe corpus and gates on score.

Until an ADR in `../adr/` formally pivots the project, agentry remains
the shipping codebase and repofit is design-only. Whether/when to write
that ADR is a decision the maintainer makes; the design here is ready
to be acted on whenever that happens.

---

## How to evolve this folder

These docs are working design notes, not ADRs. They are expected to
change as decisions are revisited.

- **Update in place** when a decision firms up — mark `Status:
  agreed`. Don't preserve dead phrasing for history; git keeps that.
- **Open questions** sections at the bottom of each doc are where new
  uncertainty lands.
- **When a decision is finally locked** by the project (not just by
  the design conversation), copy it into a numbered ADR under
  `../adr/`. Design docs are mutable; ADRs are not.
