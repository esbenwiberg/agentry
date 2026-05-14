# CI integrations

First-party wrappers that run [`@esbenwiberg/repofit`](https://www.npmjs.com/package/@esbenwiberg/repofit)
in CI, gate the PR against a committed baseline, and publish JSON + HTML
reports as build artifacts.

| Platform                  | Path                                                       |
| ------------------------- | ---------------------------------------------------------- |
| GitHub Actions            | [`github-action/`](./github-action/)                       |
| Azure DevOps Pipelines    | [`azure-pipelines/`](./azure-pipelines/)                   |

Each wrapper is a thin shim over the same CLI: `repofit check --ci --artifact
... --html ...`. If you're on a CI platform that isn't listed here, you can
get the same behavior with two lines:

```bash
npx --yes @esbenwiberg/repofit --ci \
  --artifact repofit-report.json \
  --html repofit-report.html
```

Exit codes:

- `0` — pass
- `1` — drift / advisory
- `2` — hard gate failure

The wrappers differ only in how they (a) install Node, (b) translate that exit
code into a job verdict, and (c) upload the report files as platform-native
artifacts. Each subdirectory has a README with the full parameter table and
copy-pasteable usage examples.

## Roadmap

- GitLab CI template
- CircleCI orb
- Bitbucket Pipe

PRs welcome.
