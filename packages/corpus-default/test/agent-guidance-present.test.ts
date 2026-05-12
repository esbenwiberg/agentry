import { describe, expect, test } from "vitest";
import probe from "../src/probes/agent-guidance-present.js";

describe("agent.guidance-present probe identity", () => {
  test("metadata", () => {
    expect(probe.id).toBe("agent.guidance-present");
    expect(probe.dimensions[0]?.id).toBe("context");
    expect(probe.tier).toBe("static");
    expect(probe.evidence).toContain("agent_config");
  });
});
