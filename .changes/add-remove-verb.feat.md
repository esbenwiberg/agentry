---
type: FEAT
scope: cli
---

Add agentry remove verb to uninstall a catalog entry. Deletes files matching the locked checksum; user-edited files are kept by default and only deleted with --force. Lockfile entry is pruned if all its provides are removed; partial removal preserves the entry with only the kept provides.
