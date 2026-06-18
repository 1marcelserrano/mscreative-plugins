// Orquestra: pede a coleta ao content script, roda OCR slide a slide, monta o .md
// e dispara o download. Tesseract roda AQUI (página da extensão), não no content script.

const runBtn = document.getElementById("run");
const progressBox = document.getElementById("progress");
const fill = document.getElementById("fill");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setProgress(ratio) {
  fill.style.width = `${Math.round(ratio * 100)}%`;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function collectFromTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "TRANSCRIBE_CAROUSEL" }, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Recarregue a página do Instagram e tente de novo."));
        return;
      }
      resolve(resp);
    });
  });
}

function downloadMarkdown(md, filename) {
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    // Revoga depois que o download pega o blob.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}

async function run() {
  errorEl.classList.add("hidden");
  runBtn.disabled = true;
  progressBox.classList.remove("hidden");
  setProgress(0);
  setStatus("Lendo a página…");

  try {
    const tab = await activeTab();
    if (!tab || !/^https:\/\/www\.instagram\.com\//.test(tab.url || "")) {
      throw new Error("Abra um post do Instagram na aba ativa.");
    }

    const post = await collectFromTab(tab.id);
    if (!post || post.error) throw new Error(post ? post.error : "Sem resposta da página.");

    const cfg = await chrome.storage.local.get({ useClaude: false, apiKey: "", model: "claude-haiku-4-5" });
    const claudeMode = cfg.useClaude && cfg.apiKey;
    if (cfg.useClaude && !cfg.apiKey) {
      throw new Error("Modo Claude ligado, mas sem chave. Configure nas opções da extensão.");
    }
    const engineLabel = claudeMode ? `Claude (${cfg.model})` : "Tesseract (OCR local)";
    const engineShort = claudeMode ? "Claude" : "OCR";

    const total = post.imageUrls.length;
    const slides = [];

    for (let i = 0; i < total; i++) {
      setStatus(`${engineShort} no slide ${i + 1} de ${total}…`);
      const onProgress = (p) => setProgress((i + p) / total); // slides feitos + fração do atual
      const text = claudeMode
        ? await claudeImage(post.imageUrls[i], cfg, onProgress)
        : await ocrImage(post.imageUrls[i], onProgress);
      slides.push(text);
    }

    if (!claudeMode) await terminateOcr();

    setProgress(1);
    setStatus("Montando o arquivo…");
    const md = buildMarkdown(post, slides, engineLabel);
    downloadMarkdown(md, filenameFor(post.shortcode));
    setStatus(`Pronto. ${total} slide(s) transcrito(s).`);
  } catch (e) {
    showError(String(e && e.message ? e.message : e));
    setStatus("");
  } finally {
    runBtn.disabled = false;
  }
}

runBtn.addEventListener("click", run);
