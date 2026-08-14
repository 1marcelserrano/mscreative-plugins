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
  if (!blob) throw new Error('o navegador não conseguiu gerar a imagem (tamanho grande demais?)');

  const url = URL.createObjectURL(blob);
  try {
    // O ouvinte entra ANTES do download: um blob local grava rápido demais e o
    // aviso de conclusão chega antes de haver quem escute.
    const espera = esperarDownload();
    const id = await chrome.downloads.download({ url, filename, saveAs: false });
    await espera.resolverPara(id);
    return { ok: true, filename, bytes: blob.size };
  } finally {
    URL.revokeObjectURL(url);
    descartar();
  }
}

const TETO_DOWNLOAD_MS = 20000;

function esperarDownload() {
  const vistos = new Map();
  let alvo = null;
  let terminar = null;

  function ouvir(delta) {
    vistos.set(delta.id, delta);
    if (alvo !== null && delta.id === alvo) avaliar(delta);
  }

  function avaliar(delta) {
    if (delta.state?.current === 'complete') terminar?.(null);
    if (delta.state?.current === 'interrupted') {
      terminar?.(new Error(`o download foi interrompido (${delta.error?.current ?? 'motivo desconhecido'})`));
    }
  }

  chrome.downloads.onChanged.addListener(ouvir);

  return {
    async resolverPara(id) {
      alvo = id;
      try {
        // Se o aviso chegou antes de sabermos o id, ele está guardado aqui.
        const adiantado = vistos.get(id);
        if (adiantado) {
          let erro = null;
          terminar = (e) => { erro = e; };
          avaliar(adiantado);
          if (erro) throw erro;
          if (adiantado.state?.current === 'complete') return;
        }
        // E se o download terminou antes de qualquer evento, o registro já conta.
        const [registro] = await chrome.downloads.search({ id });
        if (registro?.state === 'complete') return;
        if (registro?.state === 'interrupted') {
          throw new Error(`o download foi interrompido (${registro.error ?? 'motivo desconhecido'})`);
        }

        await new Promise((resolve, reject) => {
          const relogio = setTimeout(
            () => reject(new Error('o download não terminou a tempo')),
            TETO_DOWNLOAD_MS,
          );
          terminar = (erro) => {
            clearTimeout(relogio);
            erro ? reject(erro) : resolve();
          };
        });
      } finally {
        chrome.downloads.onChanged.removeListener(ouvir);
      }
    },
  };
}
