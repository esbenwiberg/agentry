---
type: FEAT
scope: cli
---

Implement add verb. Reads a catalog entry, copies its [[provides]] files into the target repo, applying conflict policy (prompt | overwrite | skip-if-exists). Resolves requires.entries interactively (prompts to install transitive deps). Honors flavor filters (--no-claude, --no-recipe), --dry-run, and --non-interactive. Idempotent: identical content reports as 'unchanged' regardless of policy. Soft-checks requires.tools and surfaces missing tools as warnings. Refuses entries with requires.git=true if target is not a git repo.
