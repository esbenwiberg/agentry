---
type: BREAKING
scope: cli
---

Remove `agentry doctor`. Drift detection folds into `agentry upgrade --check`,
the new CI gate (exit 0 clean, exit 1 on missing / out-of-date / user-edit /
orphaned). The `doctor` verb now prints a deprecation pointer. ADR-0005 is
Accepted; ADR-0001 is superseded for the verb taxonomy.
