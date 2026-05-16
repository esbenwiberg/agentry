# `@example/repofit-reporter-csv`

A worked example of a **third-party repofit reporter**. Implements the
`Reporter` contract from `@esbenwiberg/repofit/sdk` — same surface every
built-in reporter uses.

Emits one CSV row per probe: `id, score, reading-kind, dimension`.

## How a user wires it in

```bash
npm install --save-dev @example/repofit-reporter-csv
```

In `repofit.config.json`:

```json
{
  "reporters": {
    "plugins": [
      {
        "package": "@example/repofit-reporter-csv",
        "options": { "delimiter": "," }
      }
    ]
  }
}
```

Then invoke from the CLI by reporter name:

```bash
repofit check --reporter csv=probes.csv
```

The reporter's `name` field (`"csv"`) is the lookup key; the path on the
right of `=` is where the engine writes the output. Multiple
`--reporter` flags are fine, and reporters compose with the built-in
`--html`, `--sarif`, `--comment` flags.

## What's in [`src/index.ts`](src/index.ts)

```ts
import { defineReporter } from "@esbenwiberg/repofit/sdk";

export default defineReporter({
  name: "csv",
  render(ctx) {
    // ctx.report = the structured report (same as `repofit check --json`)
    // ctx.options = the options block from config
    // ctx.cwd     = the repo root
    return "id,score,…\n…\n";
  },
});
```

That's the whole contract. A factory form is also supported — export a
function `(options) => Reporter` if you'd prefer to close over options
once rather than reading them from `ctx` each call.
