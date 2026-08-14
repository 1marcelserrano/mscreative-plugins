export function planStitch(stops, { dpr = 1, scale = 1 } = {}) {
  if (!stops || stops.length === 0) throw new Error('sem quadros para costurar');

  const k = dpr * scale;
  const base = stops[0].rect;
  const width = Math.round(base.width * k);
  let height = 0;

  const placements = stops.map(({ scrollTop, rect }) => {
    const bottom = (scrollTop + rect.height) * k;
    if (bottom > height) height = bottom;
    return {
      sx: Math.round(rect.x * dpr),
      sy: Math.round(rect.y * dpr),
      sw: Math.round(rect.width * dpr),
      sh: Math.round(rect.height * dpr),
      dx: 0,
      dy: Math.round(scrollTop * k),
      dw: Math.round(rect.width * k),
      dh: Math.round(rect.height * k),
    };
  });

  return { width, height: Math.round(height), placements };
}
