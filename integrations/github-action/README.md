# repofit GitHub Action

A composite GitHub Action that runs [`@esbenwiberg/repofit`](https://www.npmjs.com/package/@esbenwiberg/repofit)
in CI, gates the pull request against the committed baseline, and uploads the
JSON and HTML reports as workflow artifacts.

## Quickstart

Add `.github/workflows/repofit.yml` to your repo:

```yaml
name: repofit

on:
  pull_request:
  push:
    branches: [main]

jobs:
  repofit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: esbenwiberg/repofit/integrations/github-action@v1
```

That's it. The action installs Node 22, runs `repofit check --ci`, fails the
job on hard gate failures, and uploads `repofit-report.json` +
`repofit-report.html` as artifacts.

> The action assumes you've already committed `repofit.config.json` and
> `repofit-baseline.json`. Run `npx @esbenwiberg/repofit --init` and
> `npx @esbenwiberg/repofit --accept` locally first, then commit both files.

## Inputs

| Name               | Default                | Description                                                                  |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `version`          | `latest`               | Version of `@esbenwiberg/repofit` to install. e.g. `1.0.0`, `^1`, `latest`.  |
| `node-version`     | `22`                   | Node.js version to use. repofit requires Node 22+.                           |
| `cwd`              | `${{ github.workspace }}` | Working directory to run repofit against.                                 |
| `include`          | *(empty)*              | Comma-separated opt-in tiers: `executed`, `reasoned`, or both.               |
| `artifact`         | `repofit-report.json`  | Path to write the JSON report to (relative to `cwd`).                        |
| `html`             | `repofit-report.html`  | Path to write the HTML report to. Set to `""` to skip.                       |
| `upload-artifacts` | `true`                 | Whether to upload the JSON/HTML reports as workflow artifacts.               |
| `fail-on`          | `error`                | Verdict severity that fails the job: `warn` \| `error` \| `never`.           |

### `fail-on` semantics

repofit emits exit codes from `--ci`:

- `0` — pass
- `1` — drift / advisory (informational regression below the hard threshold)
- `2` — hard gate failure

| `fail-on` | Action fails when …                                          |
| --------- | ------------------------------------------------------------ |
| `never`   | never. Reports are produced and uploaded; job is always green. |
| `error`   | repofit returns exit code 2 or higher (hard gate failure).     |
| `warn`    | repofit returns any non-zero exit code (drift + failures).     |

## Outputs

| Name          | Description                                                |
| ------------- | ---------------------------------------------------------- |
| `fitness`     | Overall fitness score (0–100), parsed from the JSON report.|
| `verdict`     | `pass`, `drift`, `fail`, or `unknown`.                     |
| `report-json` | Path to the JSON report (relative to working directory).   |
| `report-html` | Path to the HTML report (relative to working directory).   |

## Examples

### Comment the score on the PR

```yaml
- name: repofit
  id: repofit
  uses: esbenwiberg/repofit/integrations/github-action@v1

- name: Comment on PR
  if: github.event_name == 'pull_request' && always()
  uses: marocchino/sticky-pull-request-comment@v2
  with:
    header: repofit
    message: |
      **repofit:** ${{ steps.repofit.outputs.verdict }} ·
      fitness **${{ steps.repofit.outputs.fitness }}** /100 ·
      [JSON report](../artifacts) · [HTML report](../artifacts)
```

### Opt into the executed tier (slow probes)

```yaml
- uses: esbenwiberg/repofit/integrations/github-action@v1
  with:
    include: executed
```

This runs latency-tier probes (test/build/lint wall-clock). Expect the job to
take ~1–3 minutes longer.

### Run on a subdirectory

```yaml
- uses: esbenwiberg/repofit/integrations/github-action@v1
  with:
    cwd: packages/web
```

### Advisory-only mode

```yaml
- uses: esbenwiberg/repofit/integrations/github-action@v1
  with:
    fail-on: never
```

Useful for the first weeks after wiring repofit up — surface the score and
artifacts without blocking merges.

## Pinning the action

`@v1` follows the latest 1.x tag. To pin to an exact commit (recommended for
supply-chain hygiene), use the full SHA:

```yaml
uses: esbenwiberg/repofit/integrations/github-action@<sha>
```

## See also

- [repofit CLI docs](https://github.com/esbenwiberg/repofit#readme)
- [Authoring custom probes](https://github.com/esbenwiberg/repofit/blob/main/docs/authoring.md)
- [Azure DevOps integration](../azure-pipelines/README.md)
