---
description: Commit → review → PR end-to-end orchestrator
---

You are running the end-to-end ship workflow on the current branch:
commit the work, review the diff, open a pull request.

Task: $ARGUMENTS

## Instructions

Read and follow [`.claude/skills/ship/skill.md`](../skills/ship/skill.md).

The workflow chains three sub-skills in order:

1. **commits** — group, classify, fragment, commit.
2. **code-review** — prioritised diff review against the merge base.
3. **pull-requests** — push and open the PR.

Each sub-skill keeps its own approval gates. Don't shortcut them.

If the code review surfaces a **Critical** finding, stop and ask the
user before proceeding to PR.

Refuse to run on `main`/`master`/`develop` — bail with a clear message.

Full spec: [`.claude/skills/ship/rules.md`](../skills/ship/rules.md).
