# Recipe — Structured code review

A tool-agnostic prompt recipe for reviewing the diff between the current
branch and its base. Any AI coding agent (or human) can follow it.

## When to use

After commits land but before opening a PR; or whenever a structured,
prioritised review of a branch is needed.

## Steps

1. **Identify the base.** Usually the project's default branch (`main`).
   Confirm with the user if unclear.

2. **Fetch the diff:**

   ```bash
   git diff --name-only <base>...HEAD
   git diff <base>...HEAD
   ```

3. **Analyse across these axes**, skipping any that are clearly N/A for
   the language/stack:

   - **Maintainability** — function/method length, complexity, class
     size, duplication, naming clarity, comments where the *why* is
     non-obvious.
   - **Security** — input validation at trust boundaries, injection
     vectors, authn/authz on protected ops, no hardcoded secrets, no
     information leakage in error responses, dependency provenance.
   - **Performance** — N+1 patterns, sync I/O in hot paths, large
     allocations, missing dispose, caching opportunities, async usage.
   - **Consistency** — layer boundaries, existing helpers used over
     reinvention, uniform error handling, structured logging at right
     level.
   - **Tests** — new code has tests where project policy says so;
     tests are meaningful (not coverage-padding); edge cases covered;
     descriptive names.
   - **Documentation** — public surface documented, README / migration
     notes for breaking changes, ADR or comment for non-obvious *why*.

4. **Prioritise** each finding:

   - **Critical** — security holes, data loss, crashes on main flow.
   - **High** — bugs, perf regressions, behaviour breakage, missing
     tests on critical logic.
   - **Medium** — maintainability, complexity, edge-case test gaps.
   - **Low** — style, polish, naming.

5. **Limit + structure** — cap at ~10 comments. Critical and High first.
   Group findings with shared root causes.

6. **For each finding**, output:
   - Location: `path/to/file.ext:line`
   - Priority + Category
   - Issue (one or two sentences)
   - **Suggested fix** with a code snippet
   - **Why** the fix is better

7. **Summary + verdict:**
   - Counts by priority.
   - Top 3 concerns.
   - Verdict: **Approved** (no Critical/High), **Changes requested**
     (any Critical/High), or **Commented** (Medium/Low only).

## Done when

- The output ranges over the entire diff, not just one file.
- Every finding includes a fix proposal or an explicit question.
- The review ends with a verdict line.

## Don't

- Review unchanged code.
- Block on subjective style without project policy backing it.
- Output findings without fixes.
- Skip the verdict.
