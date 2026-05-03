---
description: Perform a structured code review on the current branch
---

You are performing a structured code review on the changes between the
current branch and its base.

Task: $ARGUMENTS

## Instructions

Read and follow [`.claude/skills/code-review/skill.md`](../skills/code-review/skill.md).

The workflow covers:

- Fetching the diff vs the base branch.
- Analysing across maintainability, security, performance, consistency,
  test coverage, and documentation.
- Prioritising findings (Critical / High / Medium / Low).
- Limiting and structuring comments — every comment proposes a fix or
  asks a specific question.
- Producing a summary and a verdict (Approved / Changes Requested /
  Commented).

Full spec: [`.claude/skills/code-review/rules.md`](../skills/code-review/rules.md).
