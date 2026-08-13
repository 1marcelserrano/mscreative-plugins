const MIN_OVERFLOW = 200;
const SCROLLABLE = new Set(['auto', 'scroll', 'overlay']);
const MAX_RATIO = 5;

function scoreOf(d) {
  const overflow = d.scrollHeight - d.clientHeight;
  if (overflow < MIN_OVERFLOW) return 0;
  if (d.visibleArea <= 0) return 0;
  if (!d.isDocument && !SCROLLABLE.has(d.overflowY)) return 0;
  const ratio = Math.min(overflow / Math.max(d.clientHeight, 1), MAX_RATIO);
  return d.visibleArea * ratio;
}

export function scoreCandidates(descriptors) {
  const scored = descriptors.map((d) => ({ ...d, score: scoreOf(d) }));
  const useful = scored.filter((d) => d.score > 0);
  const fallback = scored.find((d) => d.isDocument && d.score === 0);
  useful.sort((a, b) => b.score - a.score || b.visibleArea - a.visibleArea || a.depth - b.depth);
  return fallback ? [...useful, fallback] : useful;
}
