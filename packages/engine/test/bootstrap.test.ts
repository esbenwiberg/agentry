import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { writeAcceptedBaseline, writeInitialConfig } from "../src/cli/bootstrap.js";
import type { LoadedCorpus } from "../src/loader/corpus.js";

const CORPUS: LoadedCorpus = {
  name: "@esbenwiberg/corpus-default",
  version: "1.2.3",
  probes: [],
  dimensions: [],
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe("bootstrap", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repofit-test-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("writeInitialConfig writes pinned corpus + advisory gate", async () => {
    const config = await writeInitialConfig({ cwd: tmp, corpus: CORPUS });
    expect(config.corpus).toEqual([{ package: CORPUS.name, version: "1.2.3" }]);
    expect(config.gate.mode).toBe("advisory");

    const onDisk = JSON.parse(readFileSync(join(tmp, "repofit.config.json"), "utf8"));
    expect(onDisk.corpus[0].version).toBe("1.2.3");
  });

  test("writeAcceptedBaseline refuses dirty working tree", async () => {
    git(tmp, "init", "-q");
    git(tmp, "config", "user.email", "t@t");
    git(tmp, "config", "user.name", "t");
    writeFileSync(join(tmp, "stray.txt"), "x");

    await expect(
      writeAcceptedBaseline({
        cwd: tmp,
        corpus: CORPUS,
        aggregated: { dimensions: [], fitness: 70 },
        probeScores: {},
      }),
    ).rejects.toThrow(/dirty/);
  });

  test("writeAcceptedBaseline allows config/baseline files to be dirty", async () => {
    git(tmp, "init", "-q");
    git(tmp, "config", "user.email", "t@t");
    git(tmp, "config", "user.name", "t");
    writeFileSync(join(tmp, "repofit.config.json"), "{}");

    const baseline = await writeAcceptedBaseline({
      cwd: tmp,
      corpus: CORPUS,
      aggregated: {
        dimensions: [
          {
            id: "context",
            name: "Context",
            score: 80,
            gating: false,
            weight: 1,
            threshold: null,
            gatingThreshold: null,
            probeCount: 1,
          },
        ],
        fitness: 80,
      },
      probeScores: { "agent.guidance-present": 100 },
    });

    expect(baseline.fitness).toBe(80);
    expect(baseline.dimensions.context).toBe(80);
    expect(baseline.probes["agent.guidance-present"]).toBe(100);
    expect(existsSync(join(tmp, "repofit-baseline.json"))).toBe(true);
  });

  test("writeAcceptedBaseline with --dirty bypasses the check", async () => {
    git(tmp, "init", "-q");
    git(tmp, "config", "user.email", "t@t");
    git(tmp, "config", "user.name", "t");
    writeFileSync(join(tmp, "wip.txt"), "x");

    const baseline = await writeAcceptedBaseline({
      cwd: tmp,
      corpus: CORPUS,
      aggregated: { dimensions: [], fitness: null },
      probeScores: {},
      allowDirty: true,
    });
    expect(baseline.fitness).toBeNull();
  });
});
