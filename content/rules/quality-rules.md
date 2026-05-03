# Quality Rules

Quality gates, workflow tiers, and the pre-completion gate. Generic — a
project sets the actual thresholds (coverage %, lint config, etc) in its
own quality docs and pipeline.

## Quality gates

Before a commit lands, these gates apply (project may extend):

| Gate | Default | Configurable | Hard or soft? |
|---|---|---|---|
| Build | Must compile | always required | hard |
| Secret scan | No secrets in staged diff | hook | hard |
| Format / lint | Project's chosen tools | per stack | hard if hook, else soft |
| Test coverage | Project threshold (e.g., 80%) | per project | usually soft |
| Code review | No Critical/High findings before merge | reviewer call | soft, project-policy |

"Hard" = the hook or CI rejects. "Soft" = guidance, the agent should
flag but not block.

## Workflow tiers

Match the workflow weight to the change weight. The agent should
auto-pick a tier based on the change shape and confirm with the user:

### Full (complex / risky / cross-cutting)

```
[ ] Load context (CLAUDE.md, nested CLAUDE.md, relevant docs)
[ ] Implement
[ ] Lint / format on changed files
[ ] Coverage check on new code
[ ] Suggest commits with fragments
[ ] Offer code review
[ ] Open PR
```

### Small (single-feature, contained)

```
[ ] Load context
[ ] Implement
[ ] Lint / format on changed files
[ ] Suggest commits with fragments
[ ] Open PR
```

### Minimal (chore / config / docs)

```
[ ] Implement
[ ] Commit
[ ] Open PR (or skip)
```

## Skip commands

Users can downshift the workflow with explicit phrases:

| User says | Effect |
|---|---|
| `skip workflow` / `quick fix` | Drop to minimal |
| `full workflow` | Force full |
| `skip lint` | Skip lint step only |
| `skip coverage` | Skip coverage step only |
| `skip review` | Skip review step only |
| `skip pr` | Skip PR creation |

Honour skips, but if a hard gate (build, secret scan) would fail, surface
it anyway — don't silently let the user merge broken code.

## Pre-completion gate

Before reporting a task as complete, confirm:

```
✅ Lint:    [run / skipped / N/A]
✅ Coverage: [verified / skipped / N/A]
✅ Commits:  [created / no changes]
✅ Review:   [offered / skipped / N/A]
✅ PR:       [created / offered / skipped / N/A]
```

If anything is `skipped` and not `N/A`, the agent should say so out loud
in its end-of-turn summary so the user can override.

## What this file does *not* cover

- The project's specific lint config or coverage threshold — those are
  project-authored.
- Stack-specific commands (`dotnet test`, `npm run lint`, `cargo test`).
  Those live with stack overlays / catalog entries that ship them.

## See also

- `.claude/skills/code-review/rules.md` — the priority + verdict spec.
- `.githooks/pre-commit` — what's enforced mechanically.
- The project's `CLAUDE.md` — for thresholds and commands specific to
  this repo.
