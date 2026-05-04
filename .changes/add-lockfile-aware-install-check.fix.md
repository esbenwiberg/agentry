---
type: FIX
scope: cli
---

Make 'agentry add's dep-installed check consult the lockfile first and fall back to detect.any_of paths. Fixes a false-negative case where a user wiped agentry-managed files but kept the lockfile — previously add would re-install the dep, ignoring the recorded provenance.
