// Documento offscreen: existe só porque o Manifest V3 tirou canvas e
// URL.createObjectURL do processo de fundo. Ele desenha e devolve a imagem.
// Não salva arquivo: um documento offscreen enxerga apenas chrome.runtime —
// chrome.downloads é indefinido aqui, e quem baixa é o background.

const quadros = new Map();
const urlsVivas = new Set();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.alvo !== 'offscreen') return false;
  tratar(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ erro: String(error?.message ?? error) }));
  return true;
});

async function tratar(message) {
  if (message.type === 'fpc:off:reset') {
    descartar();
    return { ok: true };
  }
  if (message.type === 'fpc:off:frame') {
    const blob = await (await fetch(message.dataUrl)).blob();
    quadros.set(message.index, await createImageBitmap(blob));
    return { ok: true };
  }
  if (message.type === 'fpc:off:finish') {
    return desenhar(message.plan);
  }
  return { erro: `mensagem desconhecida: ${message.type}` };
}

function descartar() {
  for (const bitmap of quadros.values()) bitmap.close();
  quadros.clear();
  for (const url of urlsVivas) URL.revokeObjectURL(url);
  urlsVivas.clear();
}

async function desenhar(plan) {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('o navegador não abriu a área de desenho');

  for (let i = 0; i < plan.placements.length; i++) {
    const bitmap = quadros.get(i);
    if (!bitmap) throw new Error(`a tela ${i + 1} não chegou na montagem`);
    const p = plan.placements[i];
    ctx.drawImage(bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error(
      `o navegador não conseguiu gerar a imagem de ${plan.width}x${plan.height} (grande demais)`,
    );
  }

  const url = URL.createObjectURL(blob);
  urlsVivas.add(url);
  for (const bitmap of quadros.values()) bitmap.close();
  quadros.clear();

  return { ok: true, url, bytes: blob.size };
}
