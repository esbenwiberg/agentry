import { defineProbe } from "@esbenwiberg/repofit/sdk";

export default defineProbe({
  id: "agent.guidance-substance",
  version: "0.0.0",
  dimensions: [{ id: "context", weight: 1 }],
  tier: "static",
  evidence: ["agent_config"],

  rationale: `
    Guidance files exist on a quality spectrum: a stub CLAUDE.md with three
    lines is barely better than none. The total line count across all
    guidance files is a crude but honest proxy for how much project-specific
    context has been written down for agents to read.
  `,

  async detect(ev) {
    const total = ev.agent_config.guidance.reduce((sum, g) => sum + g.lines, 0);
    return { kind: "magnitude", value: total, unit: "lines" };
  },

  score: {
    kind: "magnitude",
    direction: "positive",
    bands: [
      { upTo: 10, score: 0 },
      { upTo: 40, score: 50 },
      { upTo: 120, score: 80 },
      { score: 100 },
    ],
  },

  fixtures: [
    {
      name: "no-guidance",
      evidence: { agent_config: { guidance: [] } },
      expect: { reading: { kind: "magnitude", value: 0, unit: "lines" }, score: 0 },
    },
    {
      name: "stub-guidance",
      evidence: { agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 100, lines: 5 }] } },
      expect: { reading: { kind: "magnitude", value: 5, unit: "lines" }, score: 0 },
    },
    {
      name: "modest-guidance",
      evidence: { agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 800, lines: 30 }] } },
      expect: { reading: { kind: "magnitude", value: 30, unit: "lines" }, score: 50 },
    },
    {
      name: "substantial-guidance",
      evidence: {
        agent_config: {
          guidance: [
            { path: "CLAUDE.md", bytes: 2000, lines: 80 },
            { path: "AGENTS.md", bytes: 1000, lines: 40 },
          ],
        },
      },
      expect: { reading: { kind: "magnitude", value: 120, unit: "lines" }, score: 80 },
    },
    {
      name: "rich-guidance",
      evidence: { agent_config: { guidance: [{ path: "CLAUDE.md", bytes: 6000, lines: 200 }] } },
      expect: { reading: { kind: "magnitude", value: 200, unit: "lines" }, score: 100 },
    },
  ],
});
