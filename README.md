# repofit

Measure how agent-friendly your repo is. Score, gate, and improve.

> **Status:** Phase 0 scaffold. Not yet usable. See [`docs/design/`](docs/design/) for the design corpus.

## Quickstart (planned for v1)

```bash
npx @esbenwiberg/repofit check
```

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

## Layout

```
packages/
  engine/          @esbenwiberg/repofit         — CLI + runtime
  corpus-default/  @esbenwiberg/corpus-default  — bundled probes
docs/design/                                    — design corpus
```

## License

MIT
