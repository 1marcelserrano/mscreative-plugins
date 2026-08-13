const quadros = new Map();

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
    return desenharEBaixar(message.plan, message.filename);
  }
  return { erro: `mensagem desconhecida: ${message.type}` };
}

function descartar() {
  for (const bitmap of quadros.values()) bitmap.close();
  quadros.clear();
}

async function desenharEBaixar(plan, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < plan.placements.length; i++) {
    const bitmap = quadros.get(i);
    if (!bitmap) throw new Error(`quadro ${i} não chegou`);
    const p = plan.placements[i];
    ctx.drawImage(bitmap, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  }

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  try {
    const id = await chrome.downloads.download({ url, filename, saveAs: false });
    await esperarDownload(id);
    return { ok: true, filename };
  } finally {
    URL.revokeObjectURL(url);
    descartar();
  }
}

function esperarDownload(id) {
  return new Promise((resolve, reject) => {
    function ouvir(delta) {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') {
        chrome.downloads.onChanged.removeListener(ouvir);
        resolve();
      }
      if (delta.state?.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(ouvir);
        reject(new Error('o download foi interrompido'));
      }
    }
    chrome.downloads.onChanged.addListener(ouvir);
  });
}
