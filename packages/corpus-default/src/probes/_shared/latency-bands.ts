import type { Band } from "@esbenwiberg/repofit/sdk";

export const LATENCY_BANDS: Band[] = [
  { upTo: 10_000, score: 100 },
  { upTo: 30_000, score: 80 },
  { upTo: 120_000, score: 50 },
  { upTo: 300_000, score: 20 },
  { score: 0 },
];
