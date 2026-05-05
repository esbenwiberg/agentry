# agentry

[![ci](https://github.com/esbenwiberg/agentry/actions/workflows/ci.yml/badge.svg)](https://github.com/esbenwiberg/agentry/actions/workflows/ci.yml)

> Form your agentic readiness.

`agentry` is a CLI that helps any repo become more **agent-ready** — better
context, conventions, specs, fitness checks, and workflow harness for AI
coding agents (Claude Code, Cursor, Aider, Codex, your own).

It is opinionated about one thing: **most agentic readiness can't just be
installed.** A nested `CLAUDE.md`, an ADR, a spec — those have to be
*authored* against your code. So `agentry` runs a scan-driven loop:

| Verb | Posture | What it does |
|---|---|---|
| `agentry scan` | Audit | Deterministic evidence bundle: stack, git, hygiene, security, agent-readiness, fitness. Read-only. Works on any repo. |
| `agentry brief` | Author handoff | Emits an `instructions.md` for your coding agent — bundle pointers + inlined practices + catalog snapshot. The agent does the writing. |
| `agentry add <id>` | Install | Drops in byte-perfect overlay artifacts (team commit-msg hook, secret-scan config, etc.). Lockfile-tracked, conflict-aware. |
| `agentry upgrade [--check]` | Refresh / CI gate | Refreshes installed artifacts. `--check` is the drift gate (formerly `doctor`). |
| `agentry coach <kind>` | Author | Bespoke prose authoring without running the full scan loop. |
| `agentry list` / `remove` | Browse / uninstall | The boring-but-needed pair. |

The bundled catalog ships **practices** (markdown guidance the agent
reads and adapts). **Overlays** ship byte-perfect team artifacts your
agent installs verbatim. **Re-scan** is the verification contract.

No `init`, no plugins-as-runtime, no daemon, no marketplace.

## Status

scan + brief + catalog migration shipped. `doctor` removed; drift-check
folded into `upgrade --check`. Bundled catalog is practice-only.
TeamPlanner round-trip dogfood deferred. Locked design lives in
[ADR-0005](docs/adr/0005-scan-driven-core-catalog-as-practices.md);
[ADR-0001](docs/adr/0001-product-posture-doctor-add-coach.md) is
superseded for the verb taxonomy.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test           # builds via pretest + runs vitest suite
```

Test conventions live in [`specs/test-suite/`](specs/test-suite/).

## Why

Over the last few weeks of building TeamPlanner, the highest-leverage
changes for agentic coding quality weren't framework or model upgrades —
they were *infrastructure*: nested context files, ADR conventions,
declarative agent profiles, fitness tests, drift checks, lazy startup
scripts. `agentry` extracts those patterns into a generic, tool-agnostic
CLI so any repo can adopt them in minutes.

## License

MIT — see [LICENSE](LICENSE).
