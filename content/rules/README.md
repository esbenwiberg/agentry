# content/rules/

Kernel-level rules — short, always-loaded prose meant to live in
`.claude/rules/` of a target repo. These ride alongside the project's
`CLAUDE.md` and act as a compressed reference the agent always sees.

## Layout

```
content/rules/
  core-rules.md      ← always-loaded; the smallest set that must be true
  quality-rules.md   ← quality gates, workflow tiers, pre-completion gate
```

## Conventions

- **Short.** A rules file is a reminder, not a spec. Full specs live in
  `content/skills/<capability>/rules.md`.
- **Cite the spec.** Every rule includes a one-line pointer to where the
  full spec lives, so the agent can pull it on demand.
- **Generic.** No stack-specific syntax (no `dotnet`, no `npm`, no
  `cargo`). Stack overlays add their own rule files later.
- **Stable.** Rules churn slowly. If a rule is changing every week, it
  belongs in a skill, not here.

## What is *not* shipped here

- Project-specific rules (e.g., "never mutate cached objects via
  `Cloner.CloneEntity`"). Those are authored by the adopter, not lifted
  by `agentry`.
- Stack-specific lint or coverage thresholds. Those come from stack
  overlays and live alongside their commands.
