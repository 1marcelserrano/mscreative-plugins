import { buildFilename } from './lib/filename.mjs';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fpc:start') return false;
  handleStart(message.tabId)
    .then(sendResponse)
    .catch((error) => sendResponse({ message: String(error?.message ?? error) }));
  return true;
});

async function handleStart(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const name = buildFilename({ url: tab.url, title: tab.title, date: new Date() });
  return { message: `Vai sair como ${name}` };
}
