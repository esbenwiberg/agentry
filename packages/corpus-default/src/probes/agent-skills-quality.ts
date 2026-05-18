import { defineProbe } from "@esbenwiberg/repofit/sdk";

const PROBE_VERSION = "1.0.0";
const MAX_SKILLS = 5;
const MAX_CHARS_PER_SKILL = 3_000;
const MAX_INPUT_CHARS = 18_000;

const SKILL_FILE_PATTERNS = [
  /^\.codex\/skills\/[^/]+\/SKILL\.md$/i,
  /^\.agents\/skills\/[^/]+\/SKILL\.md$/i,
  /^agents\/skills\/[^/]+\/SKILL\.md$/i,
  /^\.claude\/commands\/.+\.md$/i,
  /^\.cursor\/rules\/.+\.mdc$/i,
  /^\.windsurf\/rules\/.+\.md$/i,
  /^prompts\/agents\/.+\.md$/i,
];

const RUBRIC = {
  task: "Judge whether repository-local agent skills or slash commands would help a coding agent perform repeated workflows correctly.",
  criteria: [
    {
      id: "workflow-specific",
      description:
        "Does each skill target a concrete recurring workflow such as commit, new probe, release, smoke test, debugging CI, or review? Generic advice scores low.",
    },
    {
      id: "actionable-steps",
      description:
        "Does the skill give ordered, executable steps with commands, files, and expected validation signals?",
    },
    {
      id: "repo-fit",
      description:
        "Is the skill specific to this repository's structure, tools, conventions, and hazards rather than broadly reusable platitudes?",
    },
    {
      id: "guardrails",
      description:
        "Does the skill include safety checks, non-goals, verification, and when to stop or ask for help?",
    },
  ],
} as const;

export default defineProbe({
  id: "agent.skills-quality",
  version: PROBE_VERSION,
  dimensions: [
    { id: "context", weight: 1 },
    { id: "feedback", weight: 0.5 },
  ],
  tier: "reasoned",
  evidence: ["files", "size_stats", "judge"],

  rationale: `
    Local skills can make agents dramatically better, but only when they
    encode real workflows. A stub named /commit that says "make a good
    commit" is not useful. This probe samples local skills and judges their
    specificity, actionability, repo fit, and guardrails.
  `,

  remediation:
    "Turn local skills into concrete recipes: name the workflow, list exact commands and files, include validation signals, document hazards, and explain when the agent should stop. Good first skills are `/commit`, `/new-probe`, `/release`, `/smoke`, `/debug-failing-ci`, and `/review`.",

  async detect(ev) {
    const skillPaths = ev.size_stats.files
      .map((f) => f.path)
      .filter((p) => SKILL_FILE_PATTERNS.some((pattern) => pattern.test(p)))
      .sort();

    if (skillPaths.length === 0) {
      return { kind: "na", reason: "no local agent skills found" };
    }

    const sampled: { path: string; text: string }[] = [];
    let totalChars = 0;
    for (const p of skillPaths) {
      if (sampled.length >= MAX_SKILLS) break;
      const text = await ev.files.readText(p);
      if (!text) continue;
      const slice = text.slice(0, MAX_CHARS_PER_SKILL);
      sampled.push({ path: p, text: slice });
      totalChars += slice.length;
      if (totalChars >= MAX_INPUT_CHARS) break;
    }

    if (sampled.length === 0) {
      return { kind: "na", reason: "local agent skills declared but unreadable" };
    }

    const input = sampled.map((s) => `# ${s.path}\n\n${s.text}`).join("\n\n---\n\n");
    const result = await ev.judge.score({
      probeId: "agent.skills-quality",
      probeVersion: PROBE_VERSION,
      input,
      rubric: RUBRIC,
    });

    return {
      kind: "judge",
      score: result.score,
      perCriterion: result.perCriterion,
      rationale: result.rationale,
      model: result.model,
    };
  },

  score: { kind: "judge" },

  fixtures: [
    {
      name: "no-skills",
      evidence: {
        size_stats: {
          source: "git-ls-files",
          totalBytes: 100,
          totalFiles: 1,
          files: [{ path: "CLAUDE.md", bytes: 100, lines: 5, depth: 0 }],
        },
      },
      expect: { reading: { kind: "na", reason: "no local agent skills found" }, score: null },
    },
    {
      name: "strong-skill",
      evidence: {
        files: {
          ".codex/skills/new-probe/SKILL.md":
            "# New Probe\n\nUse when adding a corpus probe.\n\n1. Add `packages/corpus-default/src/probes/<id>.ts`.\n2. Add fixtures covering N/A, pass, and fail.\n3. Wire it in `src/index.ts`.\n4. Run `npm --workspace @esbenwiberg/corpus-default run typecheck` and `npm --workspace @esbenwiberg/corpus-default test`.\n5. Commit with `feat(corpus): ...`.\n",
        },
        size_stats: {
          source: "git-ls-files",
          totalBytes: 400,
          totalFiles: 1,
          files: [{ path: ".codex/skills/new-probe/SKILL.md", bytes: 400, lines: 10, depth: 3 }],
        },
        judge: {
          score: 80,
          perCriterion: {
            "workflow-specific": 80,
            "actionable-steps": 80,
            "repo-fit": 80,
            guardrails: 80,
          },
          rationale: "Concrete repo-specific workflow with validation and commit convention.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 80,
          perCriterion: {
            "workflow-specific": 80,
            "actionable-steps": 80,
            "repo-fit": 80,
            guardrails: 80,
          },
          rationale: "Concrete repo-specific workflow with validation and commit convention.",
          model: "fixture",
        },
        score: 80,
      },
    },
  ],
});
