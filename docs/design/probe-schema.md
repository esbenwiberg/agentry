# repofit — probe schema

> **Status:** concrete sketch. No SDK file has been written yet; this
> document is the design target. Companion to `repofit.md` (architecture
> overview).

---

## 1. The probe contract

A probe is a TypeScript module that default-exports the result of
`defineProbe()`. The SDK enforces shape at type level; the engine
re-validates at load time.

```ts
import { defineProbe } from '@repofit/sdk';

export default defineProbe({
  // Identity
  id: 'agent.claude-md-present',     // permanent; renames = new id
  version: '1.0.0',                  // semver; score-affecting changes bump

  // Placement (default suggestions; overridable by dimension recipe and project config)
  dimensions: [
    { id: 'agent-context', weight: 1 },
  ],
  tier: 'static',                    // static | derived | historical | executed | reasoned

  // Inputs
  evidence: ['files'],               // subsystems requested

  // Documentation
  rationale: `
    An agent works dramatically better when CLAUDE.md exists and describes
    the repo's conventions. Missing CLAUDE.md is one of the strongest
    negative signals for agent fitness.
  `,

  // The detector — always async
  async detect(ev): Promise<Reading> {
    return { kind: 'predicate', value: ev.files.has('CLAUDE.md') };
  },

  // Reading-type-shaped scoring config
  score: { kind: 'predicate', direction: 'positive' },

  // Reserved in v1; parsed but not executed
  remediation: {
    kind: 'guidance',
    body: { markdown: '...' },
  },

  // Required: at least one fixture per probe
  fixtures: [
    { name: 'present',
      evidence: { files: ['CLAUDE.md'] },
      expect: { reading: { kind: 'predicate', value: true }, score: 100 } },
    { name: 'absent',
      evidence: { files: [] },
      expect: { reading: { kind: 'predicate', value: false }, score: 0 } },
  ],
});
```

**Status: agreed.**

---

## 2. Reading types

```ts
type Reading =
  | { kind: 'predicate',    value: boolean }
  | { kind: 'count',        value: number,  samples?: Location[] }
  | { kind: 'magnitude',    value: number,  unit: string }
  | { kind: 'inventory',    items: InventoryItem[] }
  | { kind: 'distribution', samples: number[] }
  | { kind: 'na',           reason: string }
  | { kind: 'error',        error: string };

type InventoryItem = {
  location: Location;
  severity: 'info' | 'warn' | 'error';
  message: string;
};

type Location = {
  path: string;
  range?: { startLine: number; endLine?: number };
};
```

`samples`/`items` on count/inventory/distribution let the reporter render
actionable findings. Without locations, a finding isn't actionable.

`na` and `error` are first-class — engine drops `na` from aggregation;
`error` surfaces but does not gate by default.

**Status: agreed.**

---

## 3. Scoring config — one shape per reading type

```ts
type ScoreConfig =
  | { kind: 'predicate',    direction: 'positive' | 'negative' }
  | { kind: 'count',        direction: 'positive' | 'negative'; bands: Band[] }
  | { kind: 'magnitude',    direction: 'positive' | 'negative'; bands: Band[] }
  | { kind: 'inventory',    severityWeights: Record<Severity, number>; bands: Band[] }
  | { kind: 'distribution', stat: 'mean' | 'median' | 'p95' | 'p99' | 'max'; bands: Band[] };

type Band = { upTo?: number; score: number };  // last band omits upTo (fallback)
```

The `score.kind` must match `reading.kind`. Engine validates at load.

Example banded count scorer:

```ts
score: {
  kind: 'count',
  direction: 'negative',     // fewer = better
  bands: [
    { upTo: 0,  score: 100 },
    { upTo: 2,  score: 80  },
    { upTo: 10, score: 40  },
    { score: 0 },
  ],
}
```

**Status: agreed.**

---

## 4. Reasoned-tier probe shape

Adds a `reasoning` block; detector receives an `llm` capability.

```ts
export default defineProbe({
  id: 'docs.readme-matches-architecture',
  version: '1.0.0',
  dimensions: [{ id: 'context-quality', weight: 1 }],
  tier: 'reasoned',
  evidence: ['files', 'doc_index'],

  reasoning: {
    model: 'claude-sonnet-4-6',                   // full id, never -latest
    temperature: 0,
    promptTemplate: `...with {{evidence.doc_index.readme}}...`,
    outputSchema: { /* JSON schema for the LLM response */ },
    tokenBudget: 5000,                            // soft cap, surfaces cost
    samples: 1,                                   // self-consistency: bump to 3 for stability
    aggregate: 'first',                           // first | majority | median
  },

  rationale: `Detects drift between the README's described architecture
              and what the codebase actually looks like.`,

  async detect(ev, { llm }): Promise<Reading> {
    const response = await llm.judge({
      // engine handles cache, sampling, parsing, schema validation
    });
    return { kind: 'inventory', items: response.findings };
  },

  score: {
    kind: 'inventory',
    severityWeights: { info: 0, warn: 1, error: 3 },
    bands: [
      { upTo: 0, score: 100 },
      { upTo: 2, score: 80  },
      { upTo: 5, score: 50  },
      { score: 0 },
    ],
  },

  fixtures: [
    { name: 'matches',
      evidence: { /* ... */ },
      mockLLMResponse: { findings: [] },          // fixtures mock the LLM
      expect: { reading: { kind: 'inventory', items: [] }, score: 100 } },
  ],
});
```

The `llm` capability is only passed when `tier === 'reasoned'`. Other
tiers literally cannot call out.

**Status: agreed (shape reserved); implementation v1.x.**

---

## 5. Declarative recipes (v1)

Typed factory functions that produce the same `defineProbe()` output. The
60% case authored without writing a detector.

```ts
import { fileExists } from '@repofit/sdk/recipes';

export default fileExists({
  id: 'agent.claude-md-present',
  version: '1.0.0',
  dimensions: [{ id: 'agent-context', weight: 1 }],
  path: 'CLAUDE.md',
  rationale: '...',
});
```

Initial recipe set shipped in v1:

| Recipe | Use case |
|---|---|
| `fileExists` | Predicate: file present at path |
| `fileAbsent` | Predicate: file absent at path |
| `globCount` | Count: how many files match a glob |
| `jsonValueEquals` | Predicate: JSON path in a config equals expected |
| `fileSizeDistribution` | Distribution: byte sizes across a glob |

Recipes are pure sugar — same schema underneath. A probe authored as a
recipe is byte-identical at load time to the equivalent hand-written
probe.

**Status: agreed (ships in v1).**

---

## 6. Async detectors

`detect` is always `async`. Even synchronous detectors return
`Promise<Reading>`.

Reasons:
- Simpler API surface (no `T | Promise<T>` unions).
- Reasoned and executed tiers must be async; uniformity avoids two contracts.
- Engine can yield between probes without coordination.
- Cost is negligible (one microtask per probe).

**Status: agreed.**

---

## 7. Weight precedence

Three layers, in order of increasing authority:

1. **Probe default** — `dimensions: [{ id, weight }]` in the probe file.
2. **Dimension recipe override** — corpus dimension file can re-weight or remove probes from its composition.
3. **Project config override** — `repofit.config.json` has final say.

Same pattern as thresholds. Probes ship sensible defaults; corpus
dimension recipes curate; projects customize.

```ts
// In a dimension recipe (corpus-side override)
export default defineDimension({
  id: 'agent-context',
  name: 'Agent Context',
  description: '...',
  gating: false,
  overrides: [
    { probeId: 'agent.claude-md-present', weight: 2 },  // boost
    { probeId: 'agent.legacy-thing',      weight: 0 },  // exclude
  ],
});
```

```jsonc
// In repofit.config.json (project-side override)
{
  "dimensionOverrides": {
    "agent-context": {
      "probes": {
        "agent.claude-md-present": { "weight": 5 }
      }
    }
  }
}
```

**Status: agreed.**

---

## 8. Fixture format

Every probe declares at least one fixture. Fixtures are how the corpus
stays alive — a corpus CI run executes every fixture and verifies the
reading and score match exactly. Catches accidental score drift when a
probe is "improved."

```ts
fixtures: [
  {
    name: 'happy path',
    evidence: { /* minimal repo state for this probe */ },
    mockLLMResponse?: { /* reasoned tier only */ },
    expect: {
      reading: { /* exact expected reading */ },
      score: 100,
    },
  },
];
```

For reasoned probes, `mockLLMResponse` short-circuits the LLM call —
fixtures test the prompt-building, response-parsing, and scoring, *not*
the model.

**Status: agreed.**

---

## 9. Engine-side validation (at load time)

Load fails fast with line-pointed errors. Better to break loud than to
score wrong.

- `score.kind === reading.kind` — declared scoring matches detector output type
- Every probe declares at least one fixture
- Reasoned-tier probe declares a `reasoning` block; non-reasoned probes do not
- `evidence` list references known subsystems
- Probe ids are unique within a corpus version
- Fixture-declared evidence keys are a subset of declared `evidence`
- Banded scorers cover the full domain (last band has no `upTo`)
- Reasoned-tier `model` is a pinned id (no `-latest`)

**Status: agreed.**

---

## 10. Deferred from this schema

- **Probe groups / categories** — for `--include @docs`-style invocations. Likely yes, small addition, post-v1.
- **Probe-level criticality** separate from dimension weight. Likely no — gating dimensions cover this.
- **Multi-language probes** — punted to corpus design. Probes are atomic; ecosystem variants are separate probes feeding the same dimension.

---

## Glossary additions

- **defineProbe** — the SDK factory function for authoring probes.
- **defineDimension** — the SDK factory function for authoring dimension recipes.
- **Recipe** — typed factory for common probe patterns (`fileExists`, `globCount`, …).
- **Fixture** — declared input/expected-output pair; the unit of corpus testing.
