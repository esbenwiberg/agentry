import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "agent.guidance-concise",
  version: "1.0.0",
  dimensions: [{ id: "context", weight: 0.8 }],
  tier: "static",
  evidence: ["agent_config"],

  rationale: `
    Overly long guidance files undermine the agents they're meant to help:
    Claude ignores rules buried in noise, Codex hard-truncates combined
    guidance at 32 KB, and Copilot code review degrades past ~4 000 chars.
    The longest single guidance file is the primary risk surface — when it
    grows past ~100 lines, important instructions start getting lost.
  `,

  remediation:
    "Trim the longest guidance file to under ~100 lines. For each line ask: would removing this cause the agent to make a mistake? If not, cut it. Move stable domain knowledge to skills or commands files that load on demand rather than every session.",

  async detect(ev) {
    if (ev.agent_config.guidance.length === 0) {
      return { kind: "na", reason: "no guidance files" };
    }
    const worst = ev.agent_config.guidance.reduce((a, b) => (a.lines >= b.lines ? a : b));
    return { kind: "count", value: worst.lines, samples: [{ path: worst.path }] };
  },

  score: {
    kind: "count",
    direction: "negative",
    bands: [
      { upTo: 100, score: 100 },
      { upTo: 150, score: 75 },
      { upTo: 250, score: 40 },
      { upTo: 400, score: 10 },
      { score: 0 },
    ],
  },

  fixtures: [
    {
      name: "concise",
      evidence: {
        agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 2000, lines: 60 }] },
      },
      expect: {
        reading: { kind: "count", value: 60, samples: [{ path: "CLAUDE.md" }] },
        score: 100,
      },
    },
    {
      name: "verbose",
      evidence: {
        agent_config: { guidance: [{ path: "AGENTS.md", bytes: 12000, lines: 280 }] },
      },
      expect: {
        reading: { kind: "count", value: 280, samples: [{ path: "AGENTS.md" }] },
        score: 10,
      },
    },
    {
      name: "worst-of-many",
      evidence: {
        agent_config: {
          guidance: [
            { path: "CLAUDE.md", bytes: 2000, lines: 60 },
            { path: ".github/copilot-instructions.md", bytes: 8000, lines: 160 },
          ],
        },
      },
      expect: {
        reading: {
          kind: "count",
          value: 160,
          samples: [{ path: ".github/copilot-instructions.md" }],
        },
        score: 40,
      },
    },
    {
      name: "no-guidance",
      evidence: {
        agent_config: { guidance: [] },
      },
      expect: { reading: { kind: "na", reason: "no guidance files" }, score: null },
    },
  ],
});
