import type { Reading, ScoreConfig } from "../sdk/types.js";

export function score(reading: Reading, config: ScoreConfig): number | null {
  if (reading.kind === "na" || reading.kind === "error") return null;

  if (reading.kind !== config.kind) {
    throw new Error(`scorer mismatch: reading.kind=${reading.kind} but score.kind=${config.kind}`);
  }

  if (reading.kind === "predicate" && config.kind === "predicate") {
    const truthScore = reading.value ? 100 : 0;
    return config.direction === "positive" ? truthScore : 100 - truthScore;
  }

  throw new Error(
    `score.kind="${config.kind}" not implemented yet — Phase 1 ships predicate only.`,
  );
}
