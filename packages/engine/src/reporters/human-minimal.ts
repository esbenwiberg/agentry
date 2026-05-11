import type { Aggregated } from "../aggregator/index.js";
import type { ProbeResult } from "../runner/tiered.js";

export function renderHuman(aggregated: Aggregated, results: ProbeResult[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`repofit  ·  ${results.length} probe${results.length === 1 ? "" : "s"}`);
  lines.push("");

  for (const dim of aggregated.dimensions) {
    const scoreText = dim.score === null ? "  —  " : dim.score.toFixed(0).padStart(5, " ");
    const gating = dim.gating ? "  (gating)" : "";
    lines.push(`  ${scoreText}  ${dim.name}${gating}  ·  ${dim.probeCount} probe(s)`);
  }

  lines.push("");
  for (const r of results) {
    const verdict = readingVerdict(r);
    lines.push(`    ${verdict}  ${r.probe.id}`);
  }

  lines.push("");
  if (aggregated.fitness === null) {
    lines.push("  fitness  —  (no scored probes)");
  } else {
    lines.push(`  fitness  ${aggregated.fitness.toFixed(0)}`);
  }
  lines.push("");

  return lines.join("\n");
}

function readingVerdict(r: ProbeResult): string {
  switch (r.reading.kind) {
    case "predicate":
      return r.reading.value ? "PASS" : "FAIL";
    case "na":
      return " N/A";
    case "error":
      return " ERR";
    default:
      return r.score === null ? "  ?  " : `${r.score.toFixed(0)}`.padStart(4, " ");
  }
}
