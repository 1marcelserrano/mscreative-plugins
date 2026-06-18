// Roda na aba logada do usuário. Detecta o carrossel, percorre os slides forçando
// o lazy-load, e devolve as URLs das imagens + autor + legenda pro popup.

const SHORTCODE_RE = /\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
const NEXT_LABEL_RE = /next|próximo|proximo|avançar|avancar|seguinte/i;
const MEDIA_HOST_RE = /cdninstagram\.com|fbcdn\.net/;
const AVATAR_ALT_RE = /profile picture|foto do perfil/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getShortcode() {
  const m = location.pathname.match(SHORTCODE_RE);
  return m ? m[1] : null;
}

function findArticle() {
  // O post aberto vive num <article>; em /p/ e /reel/ costuma ser o primeiro.
  return document.querySelector("article") || document.body;
}

function isVisible(el) {
  return el && el.offsetParent !== null;
}

// Botão "Próximo" do carrossel: aria-label casando NEXT_LABEL_RE e visível.
function findNextButton(scope) {
  const buttons = scope.querySelectorAll("button[aria-label]");
  for (const b of buttons) {
    if (NEXT_LABEL_RE.test(b.getAttribute("aria-label")) && isVisible(b)) return b;
  }
  return null;
}

// Imagem de mídia real (não avatar, não ícone): host de CDN, tamanho mínimo, visível.
function isMediaImage(img) {
  if (!img.src || !MEDIA_HOST_RE.test(img.src)) return false;
  if (AVATAR_ALT_RE.test(img.alt || "")) return false;
  if (img.naturalWidth && img.naturalWidth < 250) return false;
  return isVisible(img);
}

// Dedupe por pathname da URL — o IG troca query params entre cargas da mesma imagem.
function urlKey(src) {
  try {
    return new URL(src).pathname;
  } catch {
    return src;
  }
}

function collectVisibleImages(scope, byKey) {
  for (const img of scope.querySelectorAll("img")) {
    if (isMediaImage(img)) {
      const key = urlKey(img.src);
      if (!byKey.has(key)) byKey.set(key, img.src);
    }
  }
}

// Rotas do IG que parecem perfil (/x/) mas não são.
const RESERVED_HANDLE = /^(explore|reels?|p|stories|direct|accounts|about|legal|api|developer|directory|web|challenge|ads|business|help)$/i;

// Primeiro handle de perfil (/handle/) dentro de root, ignorando rotas reservadas.
function firstHandle(root) {
  for (const a of root.querySelectorAll('a[href^="/"]')) {
    const m = a.getAttribute("href").match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (m && !RESERVED_HANDLE.test(m[1])) return m[1];
  }
  return "";
}

function metaContent(prop) {
  const el = document.querySelector(`meta[property="${prop}"]`);
  return (el && el.content) || "";
}

function getAuthor(scope) {
  // og:description começa com o USERNAME ("blankschoolbr on <data>:"); og:title traz o
  // nome de EXIBIÇÃO ("Blank on Instagram"). Pro @handle queremos o username → description 1º.
  // Remove prefixo "123 curtidas, 4 comentários - " quando presente.
  for (const prop of ["og:description", "og:title"]) {
    const c = metaContent(prop).replace(/^[\d.,\s]*\b(likes?|curtidas?|comments?|coment[áa]rios?)\b.*?[-–]\s*/i, "");
    const m = c.match(/^([A-Za-z0-9._]+)\s+on\b/);
    if (m) return m[1];
  }
  // Fallback: link de perfil dentro do escopo (nunca a página inteira → navbar).
  return firstHandle(scope.querySelector("header") || scope) || "";
}

function getCaption(scope) {
  // Legenda costuma ser o primeiro h1 dentro do article. Complemento, não bloqueante.
  const h1 = scope.querySelector("h1");
  if (h1 && h1.textContent.trim()) return h1.textContent.trim();
  // Fallback: og:description = `handle on <data>: "legenda".` — pega só o miolo.
  const og = metaContent("og:description");
  if (og) {
    const m = og.match(/:\s*["“”](.+)["“”]\.?\s*$/);
    return (m ? m[1] : og).trim();
  }
  return "";
}

async function transcribeCarousel() {
  const shortcode = getShortcode();
  if (!shortcode) {
    return { error: "Abra um post (/p/) ou reel (/reel/) do Instagram primeiro." };
  }

  const article = findArticle();
  const byKey = new Map();

  collectVisibleImages(article, byKey);

  // Percorre os slides clicando em "Próximo" até o botão sumir (guard contra loop).
  let guard = 0;
  let next = findNextButton(article);
  while (next && guard < 30) {
    next.click();
    await sleep(450);
    collectVisibleImages(article, byKey);
    next = findNextButton(article);
    guard += 1;
  }

  const imageUrls = [...byKey.values()];
  if (imageUrls.length === 0) {
    return { error: "Nenhuma imagem de carrossel encontrada. É um reel de vídeo sem slides?" };
  }

  return {
    author: getAuthor(article),
    shortcode,
    url: location.href.split("?")[0],
    caption: getCaption(article),
    imageUrls,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "TRANSCRIBE_CAROUSEL") {
    transcribeCarousel()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
    return true; // resposta assíncrona
  }
});
