import type { Reading, ScoreConfig } from "../sdk/types.js";

// Returns null for na/error readings; otherwise 0-100.
export function score(reading: Reading, config: ScoreConfig): number | null {
  if (reading.kind === "na" || reading.kind === "error") return null;

  if (reading.kind !== config.kind) {
    throw new Error(`scorer mismatch: reading.kind=${reading.kind} but score.kind=${config.kind}`);
  }

  if (reading.kind === "predicate" && config.kind === "predicate") {
    return scorePredicate(reading.value, config.direction);
  }

  throw new Error(
    `score.kind="${config.kind}" not implemented yet — Phase 1 ships predicate only.`,
  );
}

function scorePredicate(value: boolean, direction: "positive" | "negative"): number {
  const truthScore = value ? 100 : 0;
  return direction === "positive" ? truthScore : 100 - truthScore;
}
