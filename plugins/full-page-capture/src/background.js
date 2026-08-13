import { buildFilename } from './lib/filename.mjs';
import { scoreCandidates } from './lib/score-scrollers.mjs';
import { planStitch } from './lib/plan-stitch.mjs';

const OFFSCREEN_URL = 'src/offscreen.html';

const CONTENT_FILES = [
  'src/content/scroller.js',
  'src/content/overlay.js',
  'src/content/freeze.js',
  'src/content/settle.js',
  'src/content/main.js',
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fpc:start') return false;
  handleStart(message.tabId)
    .then(sendResponse)
    .catch((error) => sendResponse({ message: String(error?.message ?? error) }));
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

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const plan = planStitch(
    [{ scrollTop: 0, rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } }],
    { dpr, scale: 1 },
  );
  const filename = buildFilename({ url: tab.url, title: tab.title, date: new Date() });

  await ensureOffscreen();
  try {
    await chrome.runtime.sendMessage({
      alvo: 'offscreen',
      type: 'fpc:off:frame',
      index: 0,
      dataUrl,
    });
    const resposta = await chrome.runtime.sendMessage({
      alvo: 'offscreen',
      type: 'fpc:off:finish',
      plan,
      filename,
    });
    if (resposta?.erro) throw new Error(resposta.erro);
    return { message: `Salvo: ${filename}` };
  } finally {
    await closeOffscreen();
  }
}
