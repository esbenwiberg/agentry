# New Probe

Use this skill when adding or changing a probe in the default corpus.

1. Add or edit one file under `packages/corpus-default/src/probes/`.
2. Keep the probe id namespaced by subject, for example `tests.oracle-quality` or `agent.skills-present`.
3. Include fixtures for at least the N/A path, the clean/pass path, and the noisy/fail path.
4. Wire the probe in `packages/corpus-default/src/index.ts`.
5. Run:

```bash
npm --workspace @esbenwiberg/corpus-default run typecheck
npm --workspace @esbenwiberg/corpus-default test
npm run lint
```

6. Dogfood the new probe against this repo when useful:

```bash
node packages/engine/dist/cli/index.js explain <probe-id> --run
```

7. Commit with `feat(corpus): ...` unless the change is only formatting or docs.

Guardrails:
- Do not make static probes execute repo commands.
- Do not make reasoned probes run by default; keep them `tier: "reasoned"`.
- Prefer structured evidence over ad hoc filesystem reads.
