---
type: REFACTOR
scope: cli
---

Lift isString/isStringArray/pickString into a shared typeguards module, drop write-only fields from the Lockfile interface, import Flavor from catalog, and fast-path classifyDrift via filesIdentical so clean files skip the sha256 round-trip.
