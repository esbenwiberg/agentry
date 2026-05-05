# Code Review Workflow

Structured code review with prioritised findings on quality, security,
and performance.

## When to use

- After commits land but before opening a PR.
- When the user explicitly asks for `/review`.
- Before merging a long-running branch.

## Workflow

```
1. Fetch diff  →  2. Analyse  →  3. Prioritise  →
4. Limit + structure  →  5. Generate findings  →  6. Summarise + verdict
```

## Steps

### 1. Fetch the diff

```bash
git diff --name-only <base>...HEAD
git diff <base>...HEAD
```

If `<base>` is unclear, ask the user — usually `main` or the branch this
was cut from.

Note: file types, languages, lines added/removed, directories.

### 2. Analyse

For each changed file, look across these axes. Skip axes that don't apply
to the language/stack — but flag if a critical axis (security, tests)
isn't applicable for a non-obvious reason.

**Code maintainability**

- Function/method length and cyclomatic complexity.
- Class / module size (rough threshold: >500 lines deserves a look).
- Code duplication within and across files.
- Naming clarity (do identifiers reveal intent?).
- Comments: present where the *why* is non-obvious; absent for the
  *what* (well-named code shouldn't need that).

**Security**

- Input validation at trust boundaries (HTTP handlers, queue consumers,
  CLI args).
- Injection: SQL, shell, template, format-string.
- Authn / authz checks on every protected operation.
- No hardcoded secrets, tokens, keys.
- Error responses: no information leakage (stack traces to users, etc).
- Dependency provenance (new deps from trustworthy sources).

**Performance**

- N+1 patterns (queries / RPCs in loops).
- Synchronous I/O in hot paths.
- Memory: large allocations, retained references, missing dispose.
- Caching opportunities and cache invalidation correctness.
- Async / await usage (any forgotten `await`s, sync-over-async).

**Consistency with project patterns**

- Layer boundaries respected.
- Existing helpers / utilities used over reinvented ones.
- Error handling uniform with the rest of the codebase.
- Logging at the right level, with the right structured fields.

**Test coverage**

- New code has unit tests where the project's policy says so.
- Tests are meaningful (not coverage-padding).
- Edge cases and error paths covered.
- Test names describe scenario + expected outcome.

**Documentation**

- Public API surface documented.
- README / migration notes updated for breaking changes.
- Non-obvious decisions recorded (ADR or inline comment with *why*).

### 3. Prioritise

| Priority | Criteria | Examples |
|---|---|---|
| 🔴 Critical | Security holes, data loss, crashes in main flow | Injection, broken auth |
| 🟠 High | Bugs, perf regressions, behavioural breakage | N+1 in hot path, race condition |
| 🟡 Medium | Maintainability, test gaps | Complex function, missing edge case test |
| 🟢 Low | Style, polish, naming | Inconsistent naming, minor formatting |

### 4. Limit + structure

- Sort by priority (Critical first).
- Cap at ~10 comments unless asked otherwise. More than that and the
  review becomes noise.
- Group related findings under one comment when they share a root cause.
- Every comment must propose a fix or ask a specific question — no
  "this seems off."

### 5. Generate findings

For each comment, use this shape:

```markdown
**File:** `path/to/file.ext:42`
**Priority:** High
**Category:** Performance

**Issue:** N+1 query — relations loaded inside a loop.

**Current:**
```language
for (const project of projects) {
  const items = await db.items.findMany({ where: { projectId: project.id } });
}
```

**Suggested:**
```language
const ids = projects.map(p => p.id);
const items = await db.items.findMany({ where: { projectId: { in: ids } } });
const itemsByProject = groupBy(items, i => i.projectId);
```

**Why:** One round-trip instead of N. Same semantics, dramatically lower
latency under load.
```

### 6. Summary + verdict

```markdown
## Review Summary

Files: 8 | +245 / -67 lines

Findings:
- 🔴 Critical: 0
- 🟠 High: 2
- 🟡 Medium: 5
- 🟢 Low: 3

Top concerns:
1. Performance — N+1 in `ContractService:88`
2. Security — missing input validation on `/login`
3. Tests — no coverage for `LoginHandler`

Verdict: **Changes requested** — address Critical/High before merge.
```

Verdict rules:

- **Approved** — no Critical or High.
- **Changes requested** — any Critical or High.
- **Commented** — Medium/Low only.

## Anti-patterns

- ❌ Vague feedback ("this seems off" with no fix).
- ❌ Style nitpicks dressed up as substance.
- ❌ Reviewing the whole repo instead of the diff.
- ❌ Failing to explain *why* a fix is better.
- ❌ Skipping the verdict line — the user shouldn't have to infer it.

## Spec

Full rules: [`rules.md`](rules.md).
