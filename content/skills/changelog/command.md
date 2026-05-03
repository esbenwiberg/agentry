---
description: Create a changelog fragment for the current changes
---

You are creating a changelog fragment in `.changes/` for the current changes.

Task: $ARGUMENTS

## Instructions

Read and follow [`.claude/skills/changelog/skill.md`](../skills/changelog/skill.md).

The workflow covers:

- Deciding whether a fragment is needed (based on commit type).
- Picking a kebab-case name and scope.
- Creating the file via `_scripts/changelog/create-fragment.sh` or by hand.
- Staging the fragment alongside the code change.

Full spec: [`.claude/skills/changelog/rules.md`](../skills/changelog/rules.md).
