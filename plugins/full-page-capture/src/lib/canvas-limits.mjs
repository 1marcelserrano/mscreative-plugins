export const MAX_DIMENSION = 65535;
export const MAX_AREA = 268435456;

function cabe(width, height, k) {
  const w = width * k;
  const h = height * k;
  return h <= MAX_DIMENSION && w <= MAX_DIMENSION && w * h <= MAX_AREA;
}

export function chooseScale({ width, height, dpr = 1 }) {
  if (cabe(width, height, dpr)) {
    return { scale: 1, truncar: false, aviso: null };
  }
  if (dpr > 1 && cabe(width, height, 1)) {
    return {
      scale: 1 / dpr,
      truncar: false,
      aviso: 'A página é grande demais para a resolução nativa. Salvei em resolução simples.',
    };
  }
  return {
    scale: dpr > 1 ? 1 / dpr : 1,
    truncar: true,
    aviso: 'A página passa do limite de imagem do navegador. Cortei no máximo possível.',
  };
}
