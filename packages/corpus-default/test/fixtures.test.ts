import { runFixture } from "@esbenwiberg/repofit/sdk";
import { describe, expect, test } from "vitest";
import { probes } from "../src/index.js";

describe("corpus fixtures", () => {
  for (const probe of probes) {
    describe(probe.id, () => {
      test("declares at least one fixture", () => {
        expect(probe.fixtures.length).toBeGreaterThan(0);
      });

      for (const fixture of probe.fixtures) {
        test(`fixture: ${fixture.name}`, async () => {
          const outcome = await runFixture(probe, fixture);
          if (!outcome.ok) throw new Error(outcome.reason);
          expect(outcome.ok).toBe(true);
        });
      }
    });
  }
});
