import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { aggregate } from "../aggregator/index.js";
import { gatherAll } from "../evidence/registry.js";
import { BASELINE_FILENAME, loadBaseline } from "../loader/baseline.js";
import {
  CONFIG_FILENAME,
  DEFAULT_CONFIG,
  loadProjectConfig,
  type ProjectConfig,
} from "../loader/config.js";
import { loadDefaultCorpus } from "../loader/corpus.js";
import { effectiveDimensions } from "../loader/effective-dimensions.js";
import { renderCi } from "../reporters/ci.js";
import { renderHuman } from "../reporters/human-minimal.js";
import { type ReportInput, renderJson } from "../reporters/json.js";
import { runProbes } from "../runner/tiered.js";
import { detectDrift } from "../verdict/drift.js";
import { computeVerdict } from "../verdict/index.js";
import { writeAcceptedBaseline, writeInitialConfig } from "./bootstrap.js";

const exec = promisify(execFile);

export type CheckOptions = {
  cwd: string;
  probe?: string | undefined;
  init?: boolean;
  accept?: boolean;
  dirty?: boolean;
  output?: "human" | "json" | "ci";
  artifact?: string | undefined;
};

export async function check(opts: CheckOptions): Promise<number> {
  const corpus = await loadDefaultCorpus();

  if (opts.init) {
    const created = await writeInitialConfig({ cwd: opts.cwd, corpus });
    console.log(
      `wrote ${CONFIG_FILENAME} (corpus pinned: ${created.corpus?.[0]?.package}@${created.corpus?.[0]?.version})`,
    );
    console.log("gate mode: advisory (run `repofit check --accept` to enable ratchet)");
    return 0;
  }

  const [projectConfig, baseline, evidence] = await Promise.all([
    loadProjectConfig(opts.cwd),
    loadBaseline(opts.cwd),
    gatherAll({ cwd: opts.cwd }),
  ]);
  const config: ProjectConfig = projectConfig ?? DEFAULT_CONFIG;

  const probes = opts.probe ? corpus.probes.filter((p) => p.id === opts.probe) : corpus.probes;
  if (opts.probe && probes.length === 0) {
    console.error(`probe '${opts.probe}' not found in corpus '${corpus.name}'`);
    return 2;
  }

  const results = await runProbes(probes, evidence, { waivers: config.waivers });

  const dimensions = effectiveDimensions(corpus.dimensions, config);
  const aggregated = aggregate(results, dimensions);

  if (opts.accept) {
    const probeScores: Record<string, number | null> = {};
    for (const r of results) probeScores[r.probe.id] = r.score;
    const written = await writeAcceptedBaseline({
      cwd: opts.cwd,
      corpus,
      aggregated,
      probeScores,
      allowDirty: opts.dirty,
    });
    console.log(`wrote ${BASELINE_FILENAME} (fitness: ${fmt(written.fitness)})`);
    return 0;
  }

  const verdict = computeVerdict(aggregated, config, baseline);
  const drift = detectDrift(corpus, baseline);

  const output = opts.output ?? "human";

  if (output === "json") {
    const input = await buildReportInput({
      opts,
      corpus,
      config,
      aggregated,
      results,
      verdict,
      drift,
      baseline,
    });
    process.stdout.write(renderJson(input));
    return verdict.pass ? 0 : 1;
  }

  if (output === "ci") {
    const input = await buildReportInput({
      opts,
      corpus,
      config,
      aggregated,
      results,
      verdict,
      drift,
      baseline,
    });
    const githubActions = process.env.GITHUB_ACTIONS === "true";
    const rendered = await renderCi({ ...input, githubActions, artifactPath: opts.artifact });
    console.log(rendered.stdout);
    for (const line of rendered.annotations) console.log(line);
    return verdict.pass ? 0 : 1;
  }

  console.log(renderHuman({ aggregated, results, verdict, drift }));
  return verdict.pass ? 0 : 1;
}

type BuildReportArgs = {
  opts: CheckOptions;
  corpus: Awaited<ReturnType<typeof loadDefaultCorpus>>;
  config: ProjectConfig;
  aggregated: ReturnType<typeof aggregate>;
  results: Awaited<ReturnType<typeof runProbes>>;
  verdict: ReturnType<typeof computeVerdict>;
  drift: ReturnType<typeof detectDrift>;
  baseline: Awaited<ReturnType<typeof loadBaseline>>;
};

async function buildReportInput(args: BuildReportArgs): Promise<ReportInput> {
  return {
    cwd: args.opts.cwd,
    commit: await currentCommit(args.opts.cwd),
    corpus: args.corpus,
    config: {
      gateMode: args.config.gate.mode,
      ...(args.config.gate.include ? { include: args.config.gate.include } : {}),
    },
    aggregated: args.aggregated,
    results: args.results,
    verdict: args.verdict,
    drift: args.drift,
    baseline: args.baseline
      ? {
          fitness: args.baseline.fitness,
          dimensions: args.baseline.dimensions,
          probes: args.baseline.probes,
        }
      : null,
  };
}

async function currentCommit(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "HEAD"], { cwd });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(0);
}
