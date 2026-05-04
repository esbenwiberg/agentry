# Brief 01 — CI workflow

## Goal

Run `npm test` on every push and PR to `main` so regressions never
land green-locally / red-on-main.

## Inputs

- `package.json` — `npm ci`, `npm run typecheck`, `npm test` are the
  three commands the workflow drives.

## Outputs

- `.github/workflows/ci.yml` — single workflow, single job, runs on
  push + pull_request to `main`.
- `README.md` — status badge linking to the workflow.

## Steps

1. Create `.github/workflows/ci.yml` with one job (`test`) on
   `ubuntu-latest`.
2. Steps: `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, npm
   cache keyed on `package-lock.json`), `npm ci`, `npm run typecheck`,
   `npm test`.
3. Confirm permissions block is read-only (`contents: read`); no
   write scopes needed.
4. Add the badge to `README.md` (top of file, under the title).

## Done when

- [ ] `.github/workflows/ci.yml` exists and is valid YAML.
- [ ] Workflow runs on `push` + `pull_request` to `main`, plus
      `workflow_dispatch` for manual reruns.
- [ ] Job pins `actions/checkout@v4` and `actions/setup-node@v4`.
- [ ] Job uses `npm ci` (not `npm install`) for reproducibility.
- [ ] `permissions: contents: read` is set at workflow level.
- [ ] `concurrency` group cancels in-progress PR runs (but not main
      pushes) to avoid duplicate work on rapid pushes.
- [ ] `timeout-minutes` is set on the job.
- [ ] First push to main shows a green check on the commit.
- [ ] README.md carries a status badge linking to the workflow.
