import { describe, expect, test } from "vitest";
import { explain } from "../src/cli/explain.js";

describe("explain", () => {
  test("renders an existing probe with rationale + scoring", async () => {
    const { stdout, exitCode } = await explain({ id: "agent.guidance-present" });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Probe       agent.guidance-present");
    expect(stdout).toContain("Rationale");
    expect(stdout).toContain("Scoring");
    expect(stdout).toContain("predicate, direction positive");
  });

  test("renders a dimension with contributing probes", async () => {
    const { stdout, exitCode } = await explain({ id: "context" });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Dimension   Context");
    expect(stdout).toContain("Contributing probes");
    expect(stdout).toContain("agent.guidance-present");
  });

  test("returns exit code 2 on unknown id, listing known ids", async () => {
    const { stdout, exitCode } = await explain({ id: "no.such.thing" });
    expect(exitCode).toBe(2);
    expect(stdout).toContain("no probe or dimension 'no.such.thing'");
    expect(stdout).toContain("Known ids:");
  });
});
