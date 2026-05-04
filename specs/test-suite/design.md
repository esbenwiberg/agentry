# Test suite — Design

## Approach

Adopt **vitest** as the test runner. Tests live in a top-level `tests/`
directory mirroring the verb / module they exercise. Each verb test
spins up a tmpdir fixture, runs the CLI through a thin invocation
helper, and asserts on file effects + exit code (and on stdout for
`doctor`, where the report is the contract).

Pure modules (`drift`, `lockfile`, `catalog` loader) get co-located
unit tests under `tests/unit/`.

No mocks of `fs` or `child_process` — tests use real I/O against
disposable tmpdirs. This matches the project posture: if behavior
diverges between a mock and a real FS, the mock is the bug.

## Contracts

**Test runner**: `vitest` (devDependency).

**npm scripts**:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Test invocation helper** (`tests/helpers/cli.ts`):

```ts
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  cwd: string;  // the tmpdir that was used
}

export async function runCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): Promise<CliResult>;
```

The helper resolves to `node dist/index.js <args>` running in a
freshly-created tmpdir (or the supplied `cwd`), captures both streams,
and cleans up via vitest's `afterEach`.

**Fixture helper** (`tests/helpers/fixtures.ts`):

```ts
export async function makeRepoFixture(
  files?: Record<string, string>,
): Promise<string>;  // returns absolute tmpdir path
```

**Test file naming**:

- `tests/<verb>.test.ts` — verb contract tests (list, doctor, add, upgrade, remove, coach).
- `tests/unit/<module>.test.ts` — pure-module unit tests.
- `tests/fixtures/` — reusable fixture data (catalogs, lockfiles).

## Architecture

```
tests/
  helpers/
    cli.ts            — CLI invocation + tmpdir lifecycle
    fixtures.ts       — fixture-builder helpers
  fixtures/
    minimal-repo/     — empty git repo + package.json
    partial-install/  — repo with one entry already installed
  unit/
    drift.test.ts     — DriftKind classification
    lockfile.test.ts  — read/write/update
    catalog.test.ts   — loader + cycle detection
  list.test.ts
  doctor.test.ts
  add.test.ts
  upgrade.test.ts
  remove.test.ts
  coach.test.ts
```

Vitest auto-discovers `*.test.ts`. A `vitest.config.ts` is added only
if defaults need overriding (probably for the test timeout — tmpdir
setup can be slow on the first run as `dist/` warms).

## Constraints

- Node 22+ (already required).
- ESM-native; no CommonJS shims.
- TypeScript strict (matches `tsconfig.json`).
- No global state: each test owns its tmpdir and cleans up.
- No git config / network access required to run tests.
- Tests run against the built `dist/` artifact via a `pretest` build
  step — the user-shipped artifact is what gets exercised, not the TS
  source. (See "Decisions" below.)

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Tmpdir cleanup leaks → flaky CI | medium | `afterEach` rm -rf; vitest `--isolate` default already forks per file |
| Tests coupled to CLI stdout strings → snapshot churn | medium | Assert on file effects, not stdout, except where stdout *is* the contract (doctor) |
| Slow startup if every test rebuilds `dist/` | low | Build once in `pretest`; tests reuse the artifact |
| Vitest version churn | low | Pin to a minor; update on a deliberate cadence |

## Alternatives considered

- **`node:test`** — built-in, zero devDeps. Rejected: ESM/TS ergonomics
  weaker, snapshot story is DIY, no `--watch` UX. Saving one devDep
  isn't worth the friction.
- **Jest** — rejected: CommonJS-default, ESM/TS story is rough on Node
  22, slower startup, larger devDep tree.
- **Custom shell harness around the smoke tests we run by hand** —
  rejected: reinvents vitest poorly, no assertion library, no
  parallelism.

## Decisions

- **`pretest` build, not on-the-fly TS execution.** Vitest could run
  TS directly via its transformer, but the tests should exercise the
  same artifact users run. Cost is one extra step on `npm test`.
- **Real catalog for smoke, fixture catalog for edges.** `list` /
  `doctor` happy-path tests use the real `content/catalog/*.toml` so
  the suite reflects reality. Edge cases (cycles, malformed entries)
  use tiny purpose-built fixtures under `tests/fixtures/`.

## Open questions

- **Snapshot directory.** Vitest defaults to inline `__snapshots__/`
  next to test files. Acceptable, or move to `tests/__snapshots__/`
  for tidiness? Resolve when the first snapshot lands.
