import { defineProbe } from "@esbenwiberg/repofit/sdk";

const PROBE_VERSION = "1.0.0";
const MAX_CHARS_PER_FILE = 5_000;
const MAX_INPUT_CHARS = 20_000;

const RUBRIC = {
  task: "Judge whether multiple agent guidance files in this repository are aligned rather than giving different agents contradictory instructions.",
  criteria: [
    {
      id: "commands-align",
      description:
        "Do build, test, lint, typecheck, smoke, and release commands match across guidance files? Contradictory commands score low.",
    },
    {
      id: "architecture-align",
      description:
        "Do the files describe the same repo structure, package ownership, and architectural boundaries?",
    },
    {
      id: "conventions-align",
      description:
        "Do coding, commit, review, testing, and safety conventions agree across files?",
    },
    {
      id: "audience-fit",
      description:
        "Do tool-specific files add appropriate local nuance without forking the source of truth or drifting from shared guidance?",
    },
  ],
} as const;

export default defineProbe({
  id: "agent.guidance-aligned",
  version: PROBE_VERSION,
  dimensions: [
    { id: "context", weight: 1 },
    { id: "consistency", weight: 0.7 },
  ],
  tier: "reasoned",
  evidence: ["agent_config", "files", "judge"],

  rationale: `
    Many repos now carry several guidance files: CLAUDE.md, AGENTS.md,
    .cursorrules, .aider.conf.yml, and GitHub Copilot instructions. That is
    useful only if they agree on commands, architecture, conventions, and
    safety rules. Otherwise different agents receive different realities.
  `,

  remediation:
    "Pick one source of truth for shared repo guidance, then make tool-specific files point to it or add only tool-specific deltas. Keep commands, architecture, commit rules, testing expectations, and safety constraints aligned across CLAUDE.md, AGENTS.md, Copilot instructions, Cursor rules, and Aider config.",

  async detect(ev) {
    const guidance = ev.agent_config.guidance;
    if (guidance.length < 2) {
      return { kind: "na", reason: "fewer than two agent guidance files found" };
    }

    const sampled: { path: string; text: string }[] = [];
    let totalChars = 0;
    for (const g of guidance.sort((a, b) => a.path.localeCompare(b.path))) {
      const text = await ev.files.readText(g.path);
      if (!text) continue;
      const slice = text.slice(0, MAX_CHARS_PER_FILE);
      sampled.push({ path: g.path, text: slice });
      totalChars += slice.length;
      if (totalChars >= MAX_INPUT_CHARS) break;
    }

    if (sampled.length < 2) {
      return { kind: "na", reason: "agent guidance files declared but unreadable" };
    }

    const input = sampled.map((s) => `# ${s.path}\n\n${s.text}`).join("\n\n---\n\n");
    const result = await ev.judge.score({
      probeId: "agent.guidance-aligned",
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
      name: "single-guidance-file",
      evidence: { agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 100, lines: 5 }] } },
      expect: {
        reading: { kind: "na", reason: "fewer than two agent guidance files found" },
        score: null,
      },
    },
    {
      name: "aligned-guidance",
      evidence: {
        agent_config: {
          guidance: [
            { path: "AGENTS.md", bytes: 200, lines: 10 },
            { path: ".github/copilot-instructions.md", bytes: 200, lines: 10 },
          ],
        },
        files: {
          "AGENTS.md": "Run npm test and npm run typecheck. Commit as feat(scope): subject.\n",
          ".github/copilot-instructions.md":
            "Follow AGENTS.md. Use npm test and npm run typecheck before proposing changes.\n",
        },
        judge: {
          score: 80,
          perCriterion: {
            "commands-align": 80,
            "architecture-align": 80,
            "conventions-align": 80,
            "audience-fit": 80,
          },
          rationale: "Copilot instructions defer to AGENTS.md and repeat the same commands.",
          model: "fixture",
        },
      },
      expect: {
        reading: {
          kind: "judge",
          score: 80,
          perCriterion: {
            "commands-align": 80,
            "architecture-align": 80,
            "conventions-align": 80,
            "audience-fit": 80,
          },
          rationale: "Copilot instructions defer to AGENTS.md and repeat the same commands.",
          model: "fixture",
        },
        score: 80,
      },
    },
  ],
});
