import { aggregate } from "../aggregator/index.js";
import { gatherAll } from "../evidence/registry.js";
import { loadDefaultCorpus } from "../loader/corpus.js";
import { renderHuman } from "../reporters/human-minimal.js";
import { runProbes } from "../runner/sequential.js";

export type CheckOptions = {
  cwd: string;
  probe?: string | undefined;
};

export async function check(opts: CheckOptions): Promise<number> {
  const corpus = await loadDefaultCorpus();

  const probes = opts.probe ? corpus.probes.filter((p) => p.id === opts.probe) : corpus.probes;

  if (opts.probe && probes.length === 0) {
    console.error(`probe '${opts.probe}' not found in corpus '${corpus.name}'`);
    return 2;
  }

  const evidence = await gatherAll({ cwd: opts.cwd });
  const results = await runProbes(probes, evidence);
  const aggregated = aggregate(results, corpus.dimensions);

  console.log(renderHuman(aggregated, results));
  return 0;
}
