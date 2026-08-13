const startButton = document.getElementById('start');
const statusLine = document.getElementById('status');

function setStatus(text, tone = 'info') {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'fpc:progress') return;
  setStatus(`Tela ${message.atual} de ${message.total}...`);
});

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  setStatus('Preparando...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.runtime.sendMessage({ type: 'fpc:start', tabId: tab.id });
    setStatus(result?.message ?? 'Pronto.');
  } catch (error) {
    setStatus(String(error?.message ?? error), 'erro');
  } finally {
    startButton.disabled = false;
  }
});
