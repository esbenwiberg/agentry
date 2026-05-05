---
type: BREAKING
scope: catalog
---

Bundled catalog ships practices, not artifacts. Catalog entries gain a
`kind = "practice" | "artifact"` discriminator; practice entries declare
`practice = "<repo-relative path>"` and skip provides/detect. The six
bundled entries (`commits`, `changelog`, `code-review`, `pull-requests`,
`git-hooks`, `ship`) migrate to practice docs under `content/practices/`;
`content/skills/`, `content/recipes/`, `content/hooks/`, and
`content/scripts/` are removed. `agentry add` rejects practice ids and
points users at `brief` or an overlay. Byte-perfect team artifacts now
live exclusively in overlays.
