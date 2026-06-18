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
    // Sem isso o worker nasce de um blob: e o importScripts do core (chrome-extension://)
    // vira cross-origin e falha. Carregar direto do pacote mantém tudo same-origin.
    workerBlobURL: false,
    gzip: true,
    logger: (m) => {
      if (onProgress && m.status === "recognizing text") onProgress(m.progress);
    },
  });

  return workerPromise;
}

// Confiança mínima por linha. Texto real vem 80-95; alucinação de OCR em foto vem
// 20-50. Cortar abaixo disso limpa os slides que são imagem sem perder os de texto.
const OCR_MIN_CONFIDENCE = 60;

// Achata a hierarquia de blocos do Tesseract em linhas (v5 entrega via data.blocks).
function linesFrom(data) {
  if (Array.isArray(data.lines)) return data.lines;
  const out = [];
  for (const b of data.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) out.push(l);
    }
  }
  return out;
}

// Baixa a imagem via fetch (host_permissions contornam CORS) e roda OCR no blob.
async function ocrImage(url, onProgress) {
  const worker = await getWorker(onProgress);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${resp.status} em ${url}`);
  const blob = await resp.blob();
  const { data } = await worker.recognize(blob, {}, { blocks: true });

  const lines = linesFrom(data);
  if (lines.length) {
    return lines
      .filter((l) => (l.confidence || 0) >= OCR_MIN_CONFIDENCE)
      .map((l) => (l.text || "").replace(/\s+$/g, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  // Sem hierarquia disponível: cai pro texto cru (sem como filtrar).
  return (data.text || "").trim();
}

async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
