import type { Aggregated, DimensionResult } from "../aggregator/index.js";
import type { Baseline } from "../loader/baseline.js";
import type { GateMode, ProjectConfig } from "../loader/config.js";

export type DimensionVerdict = {
  id: string;
  pass: boolean;
  reason?: string;
};

export type Verdict = {
  mode: GateMode;
  pass: boolean;
  reasons: string[];
  dimensions: DimensionVerdict[];
};

export function computeVerdict(
  aggregated: Aggregated,
  config: ProjectConfig,
  baseline: Baseline | null,
): Verdict {
  const mode = config.gate.mode;

  if (mode === "advisory") {
    return {
      mode,
      pass: true,
      reasons: [],
      dimensions: aggregated.dimensions.map((d) => ({ id: d.id, pass: true })),
    };
  }

  if (mode === "ratchet") return ratchetVerdict(aggregated, baseline);
  return absoluteVerdict(aggregated, config);
}

function ratchetVerdict(aggregated: Aggregated, baseline: Baseline | null): Verdict {
  if (baseline === null) {
    return {
      mode: "ratchet",
      pass: false,
      reasons: ["no baseline — run `repofit check --accept` first"],
      dimensions: aggregated.dimensions.map((d) => ({ id: d.id, pass: false })),
    };
  }

  const reasons: string[] = [];
  const dimensions: DimensionVerdict[] = aggregated.dimensions.map((d) => {
    const prior = baseline.dimensions[d.id];
    if (d.score === null || prior === null || prior === undefined) {
      return { id: d.id, pass: true };
    }
    if (d.score + 1e-9 < prior) {
      const reason = `${d.id}: ${fmt(d.score)} < baseline ${fmt(prior)}`;
      reasons.push(reason);
      return { id: d.id, pass: false, reason };
    }
    return { id: d.id, pass: true };
  });

  return { mode: "ratchet", pass: reasons.length === 0, reasons, dimensions };
}

function absoluteVerdict(aggregated: Aggregated, config: ProjectConfig): Verdict {
  const threshold = config.gate.absoluteThreshold;
  const reasons: string[] = [];

  if (threshold !== undefined) {
    if (aggregated.fitness === null) {
      reasons.push("fitness is null — no scored probes");
    } else if (aggregated.fitness + 1e-9 < threshold) {
      reasons.push(`fitness ${fmt(aggregated.fitness)} < threshold ${threshold}`);
    }
  }

  const dimensions: DimensionVerdict[] = aggregated.dimensions.map((d) => dimAbsolute(d, reasons));

  return { mode: "absolute", pass: reasons.length === 0, reasons, dimensions };
}

function dimAbsolute(d: DimensionResult, reasons: string[]): DimensionVerdict {
  if (d.threshold === null || d.score === null) return { id: d.id, pass: true };
  if (d.score + 1e-9 < d.threshold) {
    const reason = `${d.id}: ${fmt(d.score)} < threshold ${d.threshold}`;
    reasons.push(reason);
    return { id: d.id, pass: false, reason };
  }
  return { id: d.id, pass: true };
}

function fmt(n: number): string {
  return n.toFixed(1);
}
