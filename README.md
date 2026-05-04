# agentry

> Form your agentic readiness.

`agentry` is a CLI that helps any repo become more **agent-ready** — better
context, conventions, specs, fitness checks, and workflow harness for AI
coding agents (Claude Code, Cursor, Aider, Codex, your own).

It is opinionated about one thing: **most agentic readiness can't just be
installed.** A nested `CLAUDE.md`, an ADR, a spec — those have to be
*authored* against your code. So `agentry` splits the surface into three
verbs:

| Verb | Posture | What it does |
|---|---|---|
| `agentry doctor` | Audit | Read-only sweep across 7 layers of agent-readiness. Tells you what's missing. Works on any repo, no install. |
| `agentry add <thing>` | Install | Drops in the genuinely-installable pieces — hooks, scripts, templates, generic skills. Lazy: only what you ask for. Conflict-aware. |
| `agentry coach <thing>` | Author | Interactive helper that walks you through writing the un-installable bits — root + nested context files, ADRs, specs, fitness rules. |

No `init`, no plugins-as-runtime, no daemon, no marketplace. Just three verbs
and a content tree you can read.

## Status

🚧 Phase 0 — repo scaffold. Not usable yet. Watch
[ADR-0001](docs/adr/0001-product-posture-doctor-add-coach.md) for the
locked design.

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
