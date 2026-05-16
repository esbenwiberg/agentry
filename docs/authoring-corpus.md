# Authoring a custom corpus

A **corpus** is an npm package that exports probes (and optionally dimensions
and fixers) for repofit to consume. The bundled
[`@esbenwiberg/corpus-default`](../packages/corpus-default/) is one corpus;
nothing stops you publishing your own.

This page covers packaging, the multi-corpus loader, and the override rules
when a third-party corpus shadows a stock probe. For writing the probes
themselves, start with [`authoring.md`](./authoring.md).

## When to write one

| Goal | Custom corpus? |
|---|---|
| Add a single probe to a project | No — load the default corpus and add the probe in your repo (rarely worth the effort) |
| Add stack-specific probes for an unsupported language (Ruby, Java, Rust…) | **Yes** |
| Replace a stock probe with a stricter / vendor-specific version | **Yes** — override by id |
| Ship a team-wide bundle of conventions (custom dimensions + probes) | **Yes** |

See [`examples/corpus-ruby/`](../examples/corpus-ruby/) for a worked example
that does both: shadows `lint.clean` with a RuboCop-aware version and adds a
new `rspec.clean` probe.

## Package layout

```
my-corpus/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts       # exports: meta, probes, dimensions?, fixers?
```

The engine loads your corpus by `import("<package>")` and reads four named
exports:

```ts
// src/index.ts
import { defineProbe, defineDimension } from "@esbenwiberg/repofit/sdk";

export const meta = { name: "@you/repofit-corpus-ruby", version: "0.1.0" };

export const probes = [
  defineProbe({ /* … */ }),
  // …
];

// Reuse stock dimensions, or define your own with new ids
export const dimensions = [
  { id: "feedback", label: "Feedback", weight: 1 },
];

export const fixers = [];  // optional
```

`package.json` should declare the engine as a peer dependency so consumers
control the version:

```json
{
  "name": "@you/repofit-corpus-ruby",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "peerDependencies": {
    "@esbenwiberg/repofit": "^1.1.0"
  }
}
```

## How consumers load it

`repofit.config.json` takes an ordered array of corpora:

```json
{
  "corpus": [
    { "package": "@esbenwiberg/corpus-default", "version": "1.1.0" },
    { "package": "@you/repofit-corpus-ruby", "version": "0.1.0" }
  ]
}
```

Both packages must be installed (`npm install --save-dev …`).

## Override rules

When two corpora export the same probe id, **later wins**. Same for
dimensions and fixers. The engine prints a one-line notice to stderr when an
override fires:

```
corpus override:
  probe lint.clean (@esbenwiberg/corpus-default → @you/repofit-corpus-ruby)
```

The notice is intentional — silent magic is worse than no magic. If you
ever see an override you didn't expect, the offending corpora are right
there in the message.

Fixers key on `probeId + mode` (`static` / `llm`), so the static and LLM
variants of the same probe's fixer can coexist across corpora.

## Versioning

- **Probe ids are stable.** Renaming an id is a breaking change for every
  downstream baseline. Bump the corpus major version and document the
  mapping if you must rename.
- **Probe `version` is informational** to consumers (it shows in `explain`
  output and the report). Bump it on any scoring-rubric change so reports
  carry the trail.
- **The corpus version pinned in `repofit.config.json` must be exact** —
  the loader rejects semver ranges (`^`, `~`, `*`, `x`). Reproducibility is
  the point.

## Authoring loop

```bash
# in your corpus repo
npm run build           # tsc
npm test                # vitest — runs every probe's fixtures

# wire it into a test project locally
cd ../my-test-project
npm install --save-dev /path/to/my-corpus
# add to repofit.config.json#corpus, then:
npx repofit
```

Probe **fixtures** are how you catch regressions before publishing. Every
`defineProbe` call should ship at least one pass case and one fail case —
they double as docs and as tests. See
[`authoring.md`](./authoring.md#fixtures) for the fixture format.
