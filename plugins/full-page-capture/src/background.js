import { buildFilename } from './lib/filename.mjs';
import { scoreCandidates } from './lib/score-scrollers.mjs';
import { planStitch } from './lib/plan-stitch.mjs';
import { chooseScale, MAX_DIMENSION } from './lib/canvas-limits.mjs';

const OFFSCREEN_URL = 'src/offscreen.html';
const MAX_TELAS = 60;
const INTERVALO_MINIMO_MS = 500;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function capturarComRetentativa(windowId, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (error) {
      const texto = String(error?.message ?? error);
      if (!/quota|MAX_CAPTURE/i.test(texto)) throw error;
      await dormir(600);
    }
  }
  throw new Error('O Chrome bloqueou as capturas seguidas. Tente de novo em alguns segundos.');
}

async function conferirAbaAtiva(tabId, windowId) {
  const [ativa] = await chrome.tabs.query({ active: true, windowId });
  if (ativa?.id !== tabId) {
    throw new Error(
      'Você mudou de aba. O Chrome só fotografa a aba ativa — não troque durante a captura.',
    );
  }
}

function avisar(atual, total) {
  chrome.runtime.sendMessage({ type: 'fpc:progress', atual, total }).catch(() => {});
}

const TETO_DOWNLOAD_MS = 20000;

// O ouvinte entra ANTES do download: um blob local grava rápido demais e o
// aviso de conclusão chega antes de haver quem escute.
async function baixarEEsperar(url, filename) {
  const vistos = new Map();
  let alvo = null;
  let terminar = null;

  function avaliar(delta) {
    if (delta.state?.current === 'complete') terminar?.(null);
    if (delta.state?.current === 'interrupted') {
      terminar?.(
        new Error(`o download foi interrompido (${delta.error?.current ?? 'motivo desconhecido'})`),
      );
    }
  }

  function ouvir(delta) {
    vistos.set(delta.id, delta);
    if (alvo !== null && delta.id === alvo) avaliar(delta);
  }

  chrome.downloads.onChanged.addListener(ouvir);
  try {
    const id = await chrome.downloads.download({ url, filename, saveAs: false });
    alvo = id;

    const [registro] = await chrome.downloads.search({ id });
    if (registro?.state === 'complete') return id;
    if (registro?.state === 'interrupted') {
      throw new Error(`o download foi interrompido (${registro.error ?? 'motivo desconhecido'})`);
    }

    const adiantado = vistos.get(id);
    if (adiantado?.state?.current === 'complete') return id;

    await new Promise((resolve, reject) => {
      const relogio = setTimeout(
        () => reject(new Error('o download não terminou a tempo')),
        TETO_DOWNLOAD_MS,
      );
      terminar = (erro) => {
        clearTimeout(relogio);
        erro ? reject(erro) : resolve();
      };
      if (adiantado) avaliar(adiantado);
    });
    return id;
  } finally {
    chrome.downloads.onChanged.removeListener(ouvir);
  }
}

const CONTENT_FILES = [
  'src/content/scroller.js',
  'src/content/overlay.js',
  'src/content/freeze.js',
  'src/content/settle.js',
  'src/content/capture.js',
  'src/content/main.js',
];

// O popup fecha assim que você clica na página para confirmar o alvo. Todo
// resultado fica guardado aqui e aparece no badge, senão o erro morre com ele.
let ultimoResultado = null;

function registrar(message, erro = false) {
  ultimoResultado = { message, erro, quando: Date.now() };
  chrome.action.setBadgeText({ text: erro ? '!' : 'ok' });
  chrome.action.setBadgeBackgroundColor({ color: erro ? '#a83232' : '#4a7c2f' });
  if (erro) console.error('[full-page-capture]', message);
  else console.log('[full-page-capture]', message);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'fpc:status') {
    sendResponse(ultimoResultado);
    return true;
  }
  if (message?.type !== 'fpc:start') return false;

  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#4a463f' });

  handleStart(message.tabId)
    .then((r) => {
      registrar(r.message);
      sendResponse(r);
    })
    .catch((error) => {
      const texto = String(error?.message ?? error);
      registrar(texto, true);
      sendResponse({ message: texto, erro: true });
    });
  return true;
});

async function ensureInjected(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
  } catch (error) {
    const texto = String(error?.message ?? error);
    if (/cannot access|chrome:\/\/|extension:\/\/|chrome-error/i.test(texto)) {
      throw new Error(
        'O Chrome não deixa capturar esta página. Vale para chrome://, a Web Store e a página de extensões.',
      );
    }
    throw error;
  }
}

async function ensureOffscreen() {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existentes.length > 0) {
    await chrome.runtime.sendMessage({ alvo: 'offscreen', type: 'fpc:off:reset' });
    return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['BLOBS'],
    justification: 'Costurar os quadros num PNG e entregar o arquivo ao download.',
  });
}

async function closeOffscreen() {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existentes.length > 0) await chrome.offscreen.closeDocument();
}

async function handleStart(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await ensureInjected(tabId);
  const { descriptors, dpr, viewport } = await chrome.tabs.sendMessage(tabId, {
    type: 'fpc:collect',
  });
  const ranked = scoreCandidates(descriptors);
  if (ranked.length === 0) throw new Error('Não achei nada que role nesta página.');
  const escolha = await chrome.tabs.sendMessage(tabId, { type: 'fpc:confirm', candidates: ranked });
  if (escolha?.cancelado) return { message: 'Cancelado.' };

  const filename = buildFilename({ url: tab.url, title: tab.title, date: new Date() });

  await ensureOffscreen();
  await chrome.tabs.sendMessage(tabId, { type: 'fpc:freeze' });

  const paradas = [];
  let truncado = false;
  let avisoTamanho = null;
  let bytes = 0;
  try {
    let anterior = -1;
    for (let index = 0; index < MAX_TELAS; index++) {
      await conferirAbaAtiva(tabId, tab.windowId);
      const parada = await chrome.tabs.sendMessage(tabId, {
        type: 'fpc:step',
        id: escolha.id,
        index,
      });
      if (index > 0 && parada.scrollTop <= anterior) break;
      anterior = parada.scrollTop;

      const dataUrl = await capturarComRetentativa(tab.windowId);
      const guardado = await chrome.runtime.sendMessage({
        alvo: 'offscreen',
        type: 'fpc:off:frame',
        index: paradas.length,
        dataUrl,
      });
      if (!guardado?.ok) {
        throw new Error(
          `A tela ${paradas.length + 1} não chegou na montagem: ${guardado?.erro ?? 'sem resposta'}`,
        );
      }
      paradas.push({ scrollTop: parada.scrollTop, rect: parada.rect });
      avisar(paradas.length, Math.ceil(parada.total / Math.max(parada.rect.height, 1)));

      if (parada.fim) break;
      if (index === MAX_TELAS - 1) truncado = true;
      await dormir(INTERVALO_MINIMO_MS);
    }
  } finally {
    await chrome.tabs.sendMessage(tabId, { type: 'fpc:restore' }).catch(() => {});
  }

  if (paradas.length === 0) throw new Error('Não consegui fotografar nenhuma tela.');

  try {
    const ultima = paradas[paradas.length - 1];
    const alturaTotal = ultima.scrollTop + ultima.rect.height;
    const { scale, truncar, aviso } = chooseScale({
      width: ultima.rect.width,
      height: alturaTotal,
      dpr,
    });
    avisoTamanho = aviso;

    const plan = planStitch(paradas, { dpr, scale });
    if (truncar) plan.height = Math.min(plan.height, MAX_DIMENSION);

    const resposta = await chrome.runtime.sendMessage({
      alvo: 'offscreen',
      type: 'fpc:off:finish',
      plan,
    });
    if (resposta?.erro) throw new Error(resposta.erro);
    if (!resposta?.ok || !resposta.url) {
      throw new Error('A montagem não respondeu. O documento de desenho pode ter sido encerrado.');
    }

    // O download acontece aqui, não no offscreen: só o processo de fundo
    // enxerga chrome.downloads. A URL do blob vive enquanto o offscreen viver,
    // por isso ele só é fechado depois que o arquivo termina de gravar.
    await baixarEEsperar(resposta.url, filename);
    bytes = resposta.bytes;
  } finally {
    await closeOffscreen();
  }

  const limite = truncado ? ` (parei em ${MAX_TELAS} telas — a página continua além disso)` : '';
  const extra = avisoTamanho ? ` ${avisoTamanho}` : '';
  const tamanho = bytes ? ` · ${(bytes / 1048576).toFixed(1)} MB` : '';
  return {
    message: `Salvo em Downloads: ${filename} · ${paradas.length} telas${tamanho}${limite}${extra}`,
  };
}
