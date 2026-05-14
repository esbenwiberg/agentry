# 0001 — Adopt npm workspaces over pnpm or turbo

- **Status:** Accepted
- **Date:** 2026-05-14

## Context

repofit ships as a CLI plus a default probe corpus, with an SDK surface for
third-party corpora. That structure naturally wants ≥2 packages from day one,
so a monorepo is the right shape. The question is which monorepo tool.

The candidates considered:

- **npm workspaces** — built into npm 7+, ships with Node, zero install
  beyond the runtime contributors already have.
- **pnpm workspaces** — faster, content-addressable store, strict by default
  but requires every contributor to install pnpm.
- **turbo (+ npm or pnpm)** — adds incremental task graph caching on top.

## Decision

Use **npm workspaces** with no orchestration layer. Build and test scripts run
through plain `npm run -w <pkg>` invocations.

## Rationale

The binding constraint is contributor friction. A repo whose pitch is
"measure how agent-friendly your codebase is" must itself be effortless to
clone and run — anything else is hypocritical. Requiring `npm install -g pnpm`
before the first build is exactly the kind of paper-cut the tool flags in
other repos (`readme.commands-runnable`, `runtime.dev-loop-bootable`).

The performance argument for pnpm and the cache argument for turbo only
matter once builds become slow. With two packages and ~30 probes, plain `tsc`
on cold cache takes well under five seconds. The optimization isn't earning
its complexity.

If the workspace grows past ~5 packages or build time crosses ~30 seconds, we
revisit — but with a concrete pain, not a speculative one.

## Consequences

- Contributors only need Node 22+ to be productive. No tool bootstrap step.
- No shared task graph cache; CI re-runs everything. Acceptable at current
  scale.
- The lockfile is `package-lock.json` (large, generated). This drove
  [ADR-0006](./0006-exclude-generated-files-from-cost.md).
- If we add a third package or task-graph complexity grows, revisit and
  supersede this ADR.
