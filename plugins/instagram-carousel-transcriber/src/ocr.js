// Wrapper do Tesseract.js. Tudo bundlado em vendor/ — a CSP do MV3 proíbe CDN.
// Carrega worker, core e idiomas via chrome.runtime.getURL.

// vendor/tesseract.min.js expõe `Tesseract` global (clássico, não-módulo).
let workerPromise = null;

async function getWorker(onProgress) {
  if (workerPromise) return workerPromise;

  workerPromise = Tesseract.createWorker("por+eng", 1, {
    workerPath: chrome.runtime.getURL("vendor/worker.min.js"),
    corePath: chrome.runtime.getURL("vendor/tesseract-core.wasm.js"),
    langPath: chrome.runtime.getURL("vendor/lang"),
    gzip: true,
    logger: (m) => {
      if (onProgress && m.status === "recognizing text") onProgress(m.progress);
    },
  });

  return workerPromise;
}

// Baixa a imagem via fetch (host_permissions contornam CORS) e roda OCR no blob.
async function ocrImage(url, onProgress) {
  const worker = await getWorker(onProgress);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${resp.status} em ${url}`);
  const blob = await resp.blob();
  const { data } = await worker.recognize(blob);
  return (data.text || "").trim();
}

async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
