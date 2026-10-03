export function fitDurationsToTotal(
  durationsMs: number[],
  totalMs?: number | null,
  minimumMs = 250,
): number[] {
  if (!durationsMs.length) return [];

  const clean = durationsMs.map((value) =>
    Number.isFinite(value) && value > 0 ? Math.round(value) : minimumMs,
  );

  if (totalMs === undefined || totalMs === null || totalMs <= 0) {
    return clean.map((value) => Math.max(minimumMs, value));
  }

  const target = Math.max(durationsMs.length, Math.round(totalMs));
  const base =
    target >= durationsMs.length * minimumMs ? minimumMs : 1;
  const remaining = target - base * durationsMs.length;
  const weightTotal = clean.reduce((sum, value) => sum + value, 0);

  if (remaining <= 0 || weightTotal <= 0) {
    const values = Array.from({ length: durationsMs.length }, () => base);
    let cursor = 0;
    while (values.reduce((sum, value) => sum + value, 0) < target) {
      values[cursor % values.length]! += 1;
      cursor += 1;
    }
    return values;
  }

  const shares = clean.map((value) => (remaining * value) / weightTotal);
  const result = shares.map((share) => base + Math.floor(share));
  let assigned = result.reduce((sum, value) => sum + value, 0);
  const fractions = shares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (assigned < target) {
    result[fractions[cursor % fractions.length]!.index]! += 1;
    assigned += 1;
    cursor += 1;
  }

  return result;
}
