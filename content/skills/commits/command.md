---
description: Analyze changes and suggest conventional commits with fragments
---

You are analyzing the working tree and proposing a commit plan that follows
conventional commit format and the project's fragment requirements.

Task: $ARGUMENTS

## Instructions

Read and follow [`.claude/skills/commits/skill.md`](../skills/commits/skill.md).

The workflow covers:

- Inspecting `git status` / `git diff` for the actual change shape.
- Grouping changes into logical commits.
- Classifying each commit (feat / fix / refactor / chore / ...).
- Creating changelog fragments for fragment-required types.
- Presenting the plan to the user *before* executing.
- Executing commits and offering follow-up review / PR.

Full spec: [`.claude/skills/commits/rules.md`](../skills/commits/rules.md).
