export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - start) / 1_000_000;
}
