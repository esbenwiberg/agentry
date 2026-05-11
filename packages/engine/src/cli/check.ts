import { aggregate } from "../aggregator/index.js";
import { gatherAll } from "../evidence/registry.js";
import { loadBaseline } from "../loader/baseline.js";
import { DEFAULT_CONFIG, loadProjectConfig, type ProjectConfig } from "../loader/config.js";
import { loadDefaultCorpus } from "../loader/corpus.js";
import { effectiveDimensions } from "../loader/effective-dimensions.js";
import { renderHuman } from "../reporters/human-minimal.js";
import { runProbes } from "../runner/tiered.js";
import { detectDrift } from "../verdict/drift.js";
import { computeVerdict } from "../verdict/index.js";
import { writeAcceptedBaseline, writeInitialConfig } from "./bootstrap.js";

export type CheckOptions = {
  cwd: string;
  probe?: string | undefined;
  init?: boolean;
  accept?: boolean;
  dirty?: boolean;
};

export async function check(opts: CheckOptions): Promise<number> {
  const corpus = await loadDefaultCorpus();

  if (opts.init) {
    const created = await writeInitialConfig({ cwd: opts.cwd, corpus });
    console.log(
      `wrote repofit.config.json (corpus pinned: ${created.corpus?.[0]?.package}@${created.corpus?.[0]?.version})`,
    );
    console.log("gate mode: advisory (run `repofit check --accept` to enable ratchet)");
    return 0;
  }

  const config: ProjectConfig = (await loadProjectConfig(opts.cwd)) ?? DEFAULT_CONFIG;
  const baseline = await loadBaseline(opts.cwd);

  const probes = opts.probe ? corpus.probes.filter((p) => p.id === opts.probe) : corpus.probes;
  if (opts.probe && probes.length === 0) {
    console.error(`probe '${opts.probe}' not found in corpus '${corpus.name}'`);
    return 2;
  }

  const evidence = await gatherAll({ cwd: opts.cwd });
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
    console.log(`wrote repofit-baseline.json (fitness: ${fmt(written.fitness)})`);
    return 0;
  }

  const verdict = computeVerdict(aggregated, config, baseline);
  const drift = detectDrift(corpus, baseline);

  console.log(renderHuman({ aggregated, results, verdict, drift }));

  return verdict.pass ? 0 : 1;
}

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(0);
}
