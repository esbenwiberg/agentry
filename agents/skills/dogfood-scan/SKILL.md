# Dogfood Scan

Use this skill when running repofit against this repository.

1. Build the CLI and corpus:

```bash
npm run build
```

2. Run a cheap default scan first:

```bash
node packages/engine/dist/cli/index.js check
```

3. For a full dogfood pass, include executed and reasoned tiers and write artifacts outside the repo:

```bash
node packages/engine/dist/cli/index.js check \
  --include executed,reasoned \
  --judge-transport codex \
  --html /private/tmp/repofit-report.html \
  --comment /private/tmp/repofit-comment.md \
  --sarif /private/tmp/repofit.sarif
```

4. Inspect failures by running individual probes:

```bash
node packages/engine/dist/cli/index.js explain <probe-id> --run
```

5. Treat false positives as corpus bugs until proven otherwise.

Guardrails:
- The full scan can take several minutes because reasoned probes call the LLM judge.
- Do not accept a new baseline until new probe noise has been reviewed.
- Keep dogfood artifacts in `/private/tmp` unless deliberately testing artifact warnings.
