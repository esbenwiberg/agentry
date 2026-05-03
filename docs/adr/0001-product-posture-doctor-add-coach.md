# 0001 — Product posture: doctor / add / coach

**Status:** Accepted
**Date:** 2026-05-03

## Context

The original framing for `agentry` was "Claude Code harness builder" — a CLI
that drops in `.claude/` skills, commands, hooks. The framing was too
narrow. Reviewing six weeks of TeamPlanner work showed the
agent-readiness surface spans seven layers (context, conventions, specs,
workflow harness, execution/startup, validation gates, architecture
fitness), most of which can't simply be installed.

Two key honest observations forced a redesign:

1. **Most agentic readiness can't be installed.** A nested `CLAUDE.md`
   summarising a subsystem, an ADR explaining a constraint, a spec for a
   feature — these have to be *authored* against the actual code. Shipping
   a fake template wastes the user's time.
2. **Tool lock-in is bad.** A CLI that only emits Claude Code skills excludes
   Cursor, Aider, Codex, and bespoke harnesses. The ecosystem is plural;
   the tool should be too.

Earlier candidate designs (full plugin runtime, `init`/`upgrade`,
manifest-with-capabilities, marketplace) were over-engineered for a solo,
phase-zero project. Each added a maintenance surface before the kernel
was proven.

## Decision

`agentry` is a CLI with **three verbs** and one cross-agent content split:

| Verb | Posture | Effect |
|---|---|---|
| `agentry doctor` | Audit | Read-only sweep across 7 layers. Reports gaps. Works on any repo, no install. |
| `agentry add <thing>` | Install | Drops in only the genuinely-installable bits — hooks, scripts, templates, generic skills. Lazy (no big bang init). Conflict-aware on every collision. |
| `agentry coach <thing>` | Author | Interactive helper for the un-installable bits — root + nested `CLAUDE.md`, ADRs, specs, fitness rules. Asks questions, never fabricates content. |

**Distribution split (A+C hybrid):** `content/skills/` ships generic
Claude-flavoured skills, `content/recipes/` ships tool-agnostic prompt
recipes that any agent can interpret. Catalog entries in `content/catalog/`
declare which one(s) a given installable provides.

**Explicit non-goals:**

- No `agentry init` (lazy install instead).
- No `agentry upgrade` v1 (defer until at least one round-trip dogfood proves what needs upgrading).
- No plugin runtime, no manifest-with-capabilities enforcement, no marketplace.
- No daemon, no MCP server, no remote plugin fetching.
- No memory stores, approval gates, or correction loops (those are runtime concerns of agents, not of the readiness CLI).

## Consequences

**Easier:**

- Adopters get a working repo from `add` without committing to a framework.
- `doctor` works against *any* repo as a value-first funnel.
- The maintenance surface is small enough for one person.
- Tool-agnostic content avoids painting `agentry` into a Claude-only corner.

**Harder:**

- `coach` is the most ambitious verb — interactive authoring with
  good prompts is craft-heavy. Mitigation: ship coach for one or two
  things first (root context file, ADR), iterate before scaling.
- Without a plugin runtime, stack-specific behaviour (e.g. .NET vs TS
  lint) lives in the catalog. Acceptable trade-off for v1; revisit if
  the catalog gets unwieldy.

**Guardrails:**

- New features must fit a verb. If they don't, write an ADR proposing a
  fourth verb — don't smuggle scope in.
- Anything Claude-specific is gated to the Claude side of the content
  split. Recipes stay tool-agnostic.

## Alternatives considered

- **Original "harness builder."** Rejected as 30% of the actual scope
  and Claude-locked.
- **Full plugin runtime + manifest + capability enforcement (codex++ style).**
  Principled parts kept (declarative manifest, layered overrides), but the
  runtime/enforcement engine deferred — over-built for a v1 that hasn't
  proven the kernel yet.
- **`init` + `upgrade` lifecycle.** Rejected — `init` invites a giant blast
  of files the user didn't ask for; `upgrade` requires 3-way merge logic
  no one will have patience to write or trust. Lazy `add` and manual ADR
  bumps cover the same surface with less rope.
- **Single skill pack for Claude Code only.** Rejected — see context: the
  ecosystem is plural and a tool-agnostic recipe layer costs little.
