---
type: FIX
scope: cli
---

Make 'agentry add' auto-install requires.entries dependencies in non-interactive mode (was silently skipping them, leaving e.g. 'add ship' with skills referencing uninstalled commits/code-review/pull-requests). Add --no-deps flag for opt-out.
