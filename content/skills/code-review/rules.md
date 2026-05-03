# Code Review Rules

The standards for reviews produced by `/review` (or any agent following
the code-review skill in this repo).

## Scope

Reviews target the **diff between the current branch and its base** —
not the entire codebase, not files merely "near" the diff.

If a finding is rooted in unchanged code, say so explicitly:

> "This is pre-existing on `main`, not introduced by this PR — flagging
> for awareness, not as a blocker."

## Priorities

| Priority | Criteria |
|---|---|
| 🔴 Critical | Security holes, data corruption / loss, crashes on the main flow, broken auth/authz. |
| 🟠 High | Bugs, performance regressions in hot paths, behavioural breakage, race conditions, missing tests on critical logic. |
| 🟡 Medium | Maintainability problems, complexity smells, missing edge-case tests, documentation gaps for new public surface. |
| 🟢 Low | Style, polish, naming, comment formatting. |

## Output shape

Every finding has:

1. **Location** — `path/to/file.ext:line` (single line or range).
2. **Priority** — one of the four above.
3. **Category** — Maintainability / Security / Performance / Consistency / Tests / Docs.
4. **Issue** — what's wrong, in one or two sentences.
5. **Suggested fix** — a concrete change. Code snippet if applicable.
6. **Why** — what improves and why. The reader should not have to guess.

A finding without a suggested fix is a question, not a finding — and
questions should be explicit:

> "Should this also handle the case where `contracts` is empty? I don't
> see a test for it."

## Limits

- Cap comments at ~10 unless the user asks for more. Beyond that, write
  a summary instead.
- Group findings with a shared root cause into one comment with multiple
  call-outs.
- Critical and High come first. If the cap is reached, drop Low first.

## Verdict

Each review ends with one of three verdicts:

- **Approved** — no Critical or High findings.
- **Changes requested** — any Critical or High finding.
- **Commented** — only Medium and Low findings.

Never end a review without a verdict — the user shouldn't have to infer.

## What reviews do *not* do

- ❌ Argue style choices the project hasn't picked a side on.
- ❌ Demand patterns the project doesn't already use.
- ❌ Re-review unchanged code.
- ❌ Block on things that are subjective without explicit project policy.
- ❌ Skip the *why* on suggested fixes.

## Project-specific overrides

A repo can extend or override these rules by adding `.agentry/review.md`
in the target repo. That file is merged on top of these defaults. If no
overrides exist, these defaults apply as-is.

## Integration

- Triggered by `/review` (see `command.md`).
- Sequence: usually after `/commit` and before `/pr`.
- Output is informational — the agent does not block the user from
  proceeding to PR.
