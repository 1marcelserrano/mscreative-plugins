import { buildFilename } from './lib/filename.mjs';
import { scoreCandidates } from './lib/score-scrollers.mjs';

const CONTENT_FILES = ['src/content/scroller.js', 'src/content/main.js'];

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

async function handleStart(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await ensureInjected(tabId);
  const { descriptors } = await chrome.tabs.sendMessage(tabId, { type: 'fpc:collect' });
  const ranked = scoreCandidates(descriptors);
  if (ranked.length === 0) throw new Error('Não achei nada que role nesta página.');
  const alvo = ranked[0];
  const name = buildFilename({ url: tab.url, title: tab.title, date: new Date() });
  return { message: `Alvo: ${alvo.label} — sairia como ${name}` };
}
