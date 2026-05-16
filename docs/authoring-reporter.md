# Authoring a custom reporter

The built-in reporters cover human (TTY), JSON, CI annotations, HTML,
SARIF, and Markdown PR comments. If you need something else — Slack
webhook, CSV, a custom HTML template for your internal dashboard — write
a reporter plugin.

A reporter is an npm package that default-exports a `Reporter` (or a
factory that returns one). repofit calls it at the end of a check run
with the same structured report `--json` would emit.

See [`examples/reporter-csv/`](../examples/reporter-csv/) for a worked
example that emits one CSV row per probe.

## The contract

```ts
import { defineReporter } from "@esbenwiberg/repofit/sdk";

export default defineReporter({
  name: "csv",                         // stable id; user invokes via --reporter csv=…
  describe: "One CSV row per probe.",  // optional, for help text

  render(ctx) {
    // ctx.report  — the structured report (same as `repofit check --json`)
    // ctx.options — the options block from repofit.config.json
    // ctx.cwd     — the repo root
    return "id,score,…\n…\n";
  },
});
```

`render` can be sync or async. It returns a string; the engine writes it
to the path the user passed on `--reporter <name>=<path>`.

## Factory form

When your reporter needs to close over config-time data, default-export a
function that returns the reporter instead:

```ts
import { defineReporter } from "@esbenwiberg/repofit/sdk";

export default (options: Record<string, unknown>) => {
  const delimiter = typeof options.delimiter === "string" ? options.delimiter : ",";
  return defineReporter({
    name: "csv",
    render(ctx) {
      // `delimiter` is fixed here once, not read per-call
      return rows(ctx.report).map((r) => r.join(delimiter)).join("\n");
    },
  });
};
```

The loader calls the factory once at startup with the `options` block;
the returned reporter is then used for every render.

## How consumers wire it in

In `repofit.config.json`:

```json
{
  "reporters": {
    "plugins": [
      {
        "package": "@you/repofit-reporter-csv",
        "options": { "delimiter": "," }
      }
    ]
  }
}
```

Then on the command line:

```bash
repofit check --reporter csv=probes.csv
```

The `csv` on the left of `=` is the reporter's `name` field. The right
side is where the rendered output gets written. Multiple `--reporter`
flags are fine, and they compose with the built-in `--html`, `--sarif`,
`--comment` flags.

## What's in the report

`ctx.report` matches the schema at
[`packages/engine/schemas/`](../packages/engine/schemas/) (under the
report type emitted by `--json`). The fields a reporter typically uses:

- `fitness: { score, baseline, delta }`
- `verdict: "pass" | "fail" | "advisory"`
- `dimensions: { [id]: { score, baseline, delta, weight, gating, probeCount } }`
- `probes: { id, score, dimension, reading, baseline, … }[]`
- `summary: { ran, pass, fail, na, error }`
- `drift: { newProbes, removedProbes, corpusVersionMismatches }`
- `commit`, `ranAt`, `corpus`, `cost`

The full type is exported as `Report` from
`@esbenwiberg/repofit/sdk`; treat `ctx.report` as that shape.

## Versioning

- **Reporter `name` is stable.** Renaming it breaks consumers' CI scripts
  (`--reporter csv=…`). Same posture as probe ids — bump the package major
  if you must rename.
- The `options` object is free-form; document what keys you read so
  consumers can pin shapes safely.

## Package layout

```
my-reporter/
├── package.json       # type: "module", peerDep on @esbenwiberg/repofit
├── tsconfig.json
└── src/
    └── index.ts       # default-exports a Reporter or factory
```

Build with `tsc`, ship `dist/`. No bundler needed.
