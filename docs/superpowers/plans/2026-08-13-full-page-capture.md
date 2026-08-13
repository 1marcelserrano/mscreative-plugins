# full-page-capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a extensão Chrome MV3 `full-page-capture`, que fotografa uma página inteira por costura de rolagem e funciona onde o GoFullPage falha — painel interno que rola, cabeçalho fixo repetido e carregamento preguiçoso.

**Architecture:** O content script coleta e executa, nunca decide nem fotografa. O service worker decide, orquestra e fotografa a aba visível. Um documento offscreen desenha a costura e baixa o PNG, porque o MV3 tirou `URL.createObjectURL` do worker. Toda a aritmética que pode quebrar em silêncio (pontuação de candidatos, plano da costura, nome do arquivo) vive em módulos puros importáveis pelo `node --test`.

**Tech Stack:** JavaScript puro, Chrome Manifest V3, `node --test` (runner embutido do Node 20+). Zero dependência npm, zero etapa de build.

## Global Constraints

- Repo: `1marcelserrano/mscreative-plugins`. Branch de trabalho: `design/full-page-capture` (já existe, já contém a spec).
- Todo o código do plugin vive em `plugins/full-page-capture/`. Caminhos neste plano são relativos à raiz do repo.
- **Zero dependência npm e zero etapa de build.** Não criar `package.json` no plugin. Os módulos puros usam extensão `.mjs`, que o Node executa como ESM sem `package.json` e que o service worker (`"type": "module"`) importa normalmente.
- Content scripts **não** são módulos ES. Eles compartilham o namespace `globalThis.__FPC` e são injetados na ordem declarada.
- Permissões do manifesto, exatamente: `["activeTab", "downloads", "scripting", "offscreen"]`. Nenhum `host_permissions`. Nenhum `content_scripts` declarativo.
- Interface e mensagens de erro em português do Brasil.
- Nome de exibição: `Captura de Página Inteira`. Versão inicial: `0.1.0`.
- Nome do arquivo gerado: `AAAA-MM-DD_dominio_titulo.png`.
- Commits em português, padrão `tipo(escopo): descrição`.
- Node 20 ou superior para rodar os testes.

---

### Task 1: Esqueleto do plugin, `filename.mjs` e CI

**Files:**
- Create: `plugins/full-page-capture/manifest.json`
- Create: `plugins/full-page-capture/src/lib/filename.mjs`
- Create: `plugins/full-page-capture/src/popup.html`
- Create: `plugins/full-page-capture/src/popup.js`
- Create: `plugins/full-page-capture/src/styles.css`
- Create: `plugins/full-page-capture/src/background.js`
- Test: `plugins/full-page-capture/test/filename.test.mjs`
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: nada.
- Produces: `buildFilename({ url, title, date }) → string`, exportada de `src/lib/filename.mjs`. O parâmetro `date` é um objeto `Date`; a função lê os componentes locais, nunca UTC.

- [ ] **Step 1: Escrever o teste que falha**

Criar `plugins/full-page-capture/test/filename.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFilename } from '../src/lib/filename.mjs';

const date = new Date(2026, 7, 13); // 13 de agosto de 2026, hora local

test('monta data, domínio e título em slug', () => {
  const name = buildFilename({
    url: 'https://www.notion.so/workspace/pagina',
    title: 'Plano Editorial — Agosto',
    date,
  });
  assert.equal(name, '2026-08-13_notion-so_plano-editorial-agosto.png');
});

test('remove acentos e cedilha do título', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: 'Ação & Coração', date });
  assert.equal(name, '2026-08-13_exemplo-com_acao-coracao.png');
});

test('título vazio vira sem-titulo', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: '   ', date });
  assert.equal(name, '2026-08-13_exemplo-com_sem-titulo.png');
});

test('corta o título em 60 caracteres sem deixar hífen sobrando', () => {
  const title = 'a'.repeat(30) + ' ' + 'b'.repeat(40);
  const name = buildFilename({ url: 'https://exemplo.com', title, date });
  const slug = name.split('_')[2].replace('.png', '');
  assert.ok(slug.length <= 60, `slug tem ${slug.length} caracteres`);
  assert.ok(!slug.endsWith('-'), 'slug não pode terminar em hífen');
});

test('descarta caracteres proibidos em nome de arquivo', () => {
  const name = buildFilename({ url: 'https://exemplo.com', title: 'a/b\\c:d*e?f"g<h>i|j', date });
  assert.equal(name, '2026-08-13_exemplo-com_a-b-c-d-e-f-g-h-i-j.png');
});

test('url inválida cai em pagina', () => {
  const name = buildFilename({ url: 'nao-e-uma-url', title: 'Teste', date });
  assert.equal(name, '2026-08-13_pagina_teste.png');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: FAIL com `Cannot find module .../src/lib/filename.mjs`.

- [ ] **Step 3: Implementar `filename.mjs`**

Criar `plugins/full-page-capture/src/lib/filename.mjs`:

```js
const MAX_SLUG = 60;

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hostSlug(url) {
  try {
    return slugify(new URL(url).hostname.replace(/^www\./, '')) || 'pagina';
  } catch {
    return 'pagina';
  }
}

export function buildFilename({ url, title, date }) {
  const day = isoLocalDate(date);
  const host = hostSlug(url);
  const full = slugify(title);
  const cut = full.slice(0, MAX_SLUG).replace(/-+$/, '');
  return `${day}_${host}_${cut || 'sem-titulo'}.png`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Criar o manifesto**

Criar `plugins/full-page-capture/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Captura de Página Inteira",
  "description": "Fotografa a página inteira, inclusive quando quem rola é um painel interno. Sem cabeçalho repetido, sem buraco de carregamento preguiçoso.",
  "version": "0.1.0",
  "permissions": ["activeTab", "downloads", "scripting", "offscreen"],
  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup.html",
    "default_title": "Capturar a página inteira"
  }
}
```

- [ ] **Step 6: Criar o popup mínimo e o worker mínimo**

Criar `plugins/full-page-capture/src/popup.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <button id="start">Capturar página</button>
    <p id="status" role="status"></p>
    <script src="popup.js"></script>
  </body>
</html>
```

Criar `plugins/full-page-capture/src/styles.css`:

```css
body {
  width: 260px;
  margin: 0;
  padding: 16px;
  font: 14px/1.4 system-ui, sans-serif;
  background: #111114;
  color: #b2a898;
}
button {
  width: 100%;
  padding: 10px 12px;
  font: inherit;
  color: #111114;
  background: #b2a898;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
#status {
  margin: 12px 0 0;
  min-height: 1.4em;
  font-size: 13px;
}
#status[data-tone='erro'] {
  color: #e88b6a;
}
```

Criar `plugins/full-page-capture/src/popup.js`:

```js
const startButton = document.getElementById('start');
const statusLine = document.getElementById('status');

function setStatus(text, tone = 'info') {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

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
```

Criar `plugins/full-page-capture/src/background.js`:

```js
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
```

- [ ] **Step 7: Carregar a extensão e conferir**

Abrir `chrome://extensions`, ligar o Modo do desenvolvedor, clicar em "Carregar sem compactação" e apontar para `plugins/full-page-capture/`. Abrir qualquer site, clicar no ícone, clicar em "Capturar página".

Esperado: o popup mostra `Vai sair como 2026-08-13_dominio_titulo.png`. Nenhum erro no console da extensão.

- [ ] **Step 8: Criar o workflow de CI**

Criar `.github/workflows/test.yml`:

```yaml
name: test
on: [push, pull_request]
jobs:
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: node --test plugins/full-page-capture/test/
```

- [ ] **Step 9: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture .github/workflows/test.yml
git commit -m "feat(full-page-capture): o esqueleto da extensao sobe com o nome do arquivo ja testado"
```

---

### Task 2: Pontuação dos candidatos a scroller

**Files:**
- Create: `plugins/full-page-capture/src/lib/score-scrollers.mjs`
- Test: `plugins/full-page-capture/test/score-scrollers.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `scoreCandidates(descriptors) → Array<Descriptor & { score: number }>`, ordenada do maior para o menor score. Um `Descriptor` é `{ id: number, scrollHeight: number, clientHeight: number, overflowY: string, visibleArea: number, depth: number, isDocument: boolean, label: string }`. A função é pura e não conhece DOM. O descritor do documento sempre sai na lista, mesmo com score zero, e sempre em último lugar quando não pontua — é o alvo de reserva.

- [ ] **Step 1: Escrever o teste que falha**

Criar `plugins/full-page-capture/test/score-scrollers.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidates } from '../src/lib/score-scrollers.mjs';

function descriptor(over = {}) {
  return {
    id: 1,
    scrollHeight: 4000,
    clientHeight: 800,
    overflowY: 'auto',
    visibleArea: 800 * 1000,
    depth: 5,
    isDocument: false,
    label: 'div',
    ...over,
  };
}

const documentoParado = descriptor({
  id: 0, isDocument: true, overflowY: 'visible',
  scrollHeight: 900, clientHeight: 900, visibleArea: 1200 * 900, depth: 0, label: 'documento',
});

test('painel interno vence quando o documento não rola', () => {
  const painel = descriptor({ id: 1, scrollHeight: 5000, clientHeight: 800, visibleArea: 900 * 800 });
  const [primeiro] = scoreCandidates([documentoParado, painel]);
  assert.equal(primeiro.id, 1);
});

test('documento vence numa página comum', () => {
  const documento = descriptor({
    id: 0, isDocument: true, overflowY: 'visible',
    scrollHeight: 6000, clientHeight: 900, visibleArea: 1200 * 900, depth: 0,
  });
  const lateral = descriptor({ id: 2, scrollHeight: 2000, clientHeight: 600, visibleArea: 240 * 600 });
  const [primeiro] = scoreCandidates([documento, lateral]);
  assert.equal(primeiro.id, 0);
});

test('elemento sem área visível não pontua', () => {
  const oculto = descriptor({ id: 3, visibleArea: 0 });
  const resultado = scoreCandidates([documentoParado, oculto]);
  assert.ok(!resultado.some((c) => c.id === 3 && c.score > 0));
});

test('overflow hidden não pontua', () => {
  const travado = descriptor({ id: 4, overflowY: 'hidden' });
  const resultado = scoreCandidates([documentoParado, travado]);
  assert.ok(!resultado.some((c) => c.id === 4 && c.score > 0));
});

test('sobra de rolagem menor que 200px não pontua', () => {
  const raso = descriptor({ id: 5, scrollHeight: 950, clientHeight: 800 });
  const resultado = scoreCandidates([documentoParado, raso]);
  assert.ok(!resultado.some((c) => c.id === 5 && c.score > 0));
});

test('o documento sobra como reserva mesmo sem pontuar', () => {
  const resultado = scoreCandidates([documentoParado]);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].isDocument, true);
});

test('empate de área é desempatado pelo elemento mais raso', () => {
  const fundo = descriptor({ id: 6, depth: 12 });
  const raso = descriptor({ id: 7, depth: 3 });
  const [primeiro] = scoreCandidates([fundo, raso, documentoParado]);
  assert.equal(primeiro.id, 7);
});

test('lista sem nenhum candidato devolve lista vazia', () => {
  assert.deepEqual(scoreCandidates([]), []);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/score-scrollers.test.mjs
```

Esperado: FAIL com `Cannot find module .../src/lib/score-scrollers.mjs`.

- [ ] **Step 3: Implementar `score-scrollers.mjs`**

Criar `plugins/full-page-capture/src/lib/score-scrollers.mjs`:

```js
const MIN_OVERFLOW = 200;
const SCROLLABLE = new Set(['auto', 'scroll', 'overlay']);
const MAX_RATIO = 5;

function scoreOf(d) {
  const overflow = d.scrollHeight - d.clientHeight;
  if (overflow < MIN_OVERFLOW) return 0;
  if (d.visibleArea <= 0) return 0;
  if (!d.isDocument && !SCROLLABLE.has(d.overflowY)) return 0;
  const ratio = Math.min(overflow / Math.max(d.clientHeight, 1), MAX_RATIO);
  return d.visibleArea * ratio;
}

export function scoreCandidates(descriptors) {
  const scored = descriptors.map((d) => ({ ...d, score: scoreOf(d) }));
  const useful = scored.filter((d) => d.score > 0);
  const fallback = scored.find((d) => d.isDocument && d.score === 0);
  useful.sort((a, b) => b.score - a.score || b.visibleArea - a.visibleArea || a.depth - b.depth);
  return fallback ? [...useful, fallback] : useful;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): a pontuacao decide quem rola de verdade, e ela e testavel fora do navegador"
```

---

### Task 3: Plano da costura

**Files:**
- Create: `plugins/full-page-capture/src/lib/plan-stitch.mjs`
- Test: `plugins/full-page-capture/test/plan-stitch.test.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: `planStitch(stops, { dpr, scale }) → { width, height, placements }`.
  - `stops` é `Array<{ scrollTop: number, rect: { x, y, width, height } }>`, na ordem em que os quadros foram fotografados. `scrollTop` é a rolagem **efetiva** em pixels CSS; `rect` é o retângulo do alvo dentro da viewport, em pixels CSS.
  - `dpr` é o `devicePixelRatio` da aba; `scale` é 1 para resolução nativa e `1/dpr` para resolução simples.
  - `placements` é `Array<{ sx, sy, sw, sh, dx, dy, dw, dh }>`, na ordem de desenho, pronta para `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`. As coordenadas de origem estão em pixels físicos da foto; as de destino, em pixels do canvas final.
  - Lança `Error('sem quadros para costurar')` se `stops` estiver vazio.

- [ ] **Step 1: Escrever o teste que falha**

Criar `plugins/full-page-capture/test/plan-stitch.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planStitch } from '../src/lib/plan-stitch.mjs';

const rect = { x: 0, y: 0, width: 1200, height: 800 };

test('dois quadros sem sobreposição empilham na altura', () => {
  const plano = planStitch([{ scrollTop: 0, rect }, { scrollTop: 800, rect }], { dpr: 1, scale: 1 });
  assert.equal(plano.width, 1200);
  assert.equal(plano.height, 1600);
  assert.deepEqual(plano.placements[1], {
    sx: 0, sy: 0, sw: 1200, sh: 800, dx: 0, dy: 800, dw: 1200, dh: 800,
  });
});

test('o último quadro se sobrepõe e não estica a imagem', () => {
  const plano = planStitch(
    [{ scrollTop: 0, rect }, { scrollTop: 800, rect }, { scrollTop: 1300, rect }],
    { dpr: 1, scale: 1 },
  );
  assert.equal(plano.height, 2100);
  assert.equal(plano.placements[2].dy, 1300);
});

test('densidade de pixel 2 dobra origem e destino', () => {
  const plano = planStitch([{ scrollTop: 0, rect }, { scrollTop: 800, rect }], { dpr: 2, scale: 1 });
  assert.equal(plano.width, 2400);
  assert.equal(plano.height, 3200);
  assert.deepEqual(plano.placements[1], {
    sx: 0, sy: 0, sw: 2400, sh: 1600, dx: 0, dy: 1600, dw: 2400, dh: 1600,
  });
});

test('resolução simples reduz o destino mas não a origem', () => {
  const plano = planStitch([{ scrollTop: 0, rect }], { dpr: 2, scale: 0.5 });
  assert.equal(plano.width, 1200);
  assert.equal(plano.height, 800);
  assert.deepEqual(plano.placements[0], {
    sx: 0, sy: 0, sw: 2400, sh: 1600, dx: 0, dy: 0, dw: 1200, dh: 800,
  });
});

test('painel interno recorta pelo retângulo dele', () => {
  const painel = { x: 320, y: 64, width: 880, height: 736 };
  const plano = planStitch([{ scrollTop: 0, rect: painel }], { dpr: 2, scale: 1 });
  assert.equal(plano.width, 1760);
  assert.equal(plano.height, 1472);
  assert.deepEqual(plano.placements[0], {
    sx: 640, sy: 128, sw: 1760, sh: 1472, dx: 0, dy: 0, dw: 1760, dh: 1472,
  });
});

test('um quadro só vira uma imagem do tamanho do quadro', () => {
  const plano = planStitch([{ scrollTop: 0, rect }], { dpr: 1, scale: 1 });
  assert.equal(plano.height, 800);
  assert.equal(plano.placements.length, 1);
});

test('lista vazia é erro', () => {
  assert.throws(() => planStitch([], { dpr: 1, scale: 1 }), /sem quadros/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/plan-stitch.test.mjs
```

Esperado: FAIL com `Cannot find module .../src/lib/plan-stitch.mjs`.

- [ ] **Step 3: Implementar `plan-stitch.mjs`**

Criar `plugins/full-page-capture/src/lib/plan-stitch.mjs`:

```js
export function planStitch(stops, { dpr = 1, scale = 1 } = {}) {
  if (!stops || stops.length === 0) throw new Error('sem quadros para costurar');

  const k = dpr * scale;
  const base = stops[0].rect;
  const width = Math.round(base.width * k);
  let height = 0;

  const placements = stops.map(({ scrollTop, rect }) => {
    const bottom = (scrollTop + rect.height) * k;
    if (bottom > height) height = bottom;
    return {
      sx: Math.round(rect.x * dpr),
      sy: Math.round(rect.y * dpr),
      sw: Math.round(rect.width * dpr),
      sh: Math.round(rect.height * dpr),
      dx: 0,
      dy: Math.round(scrollTop * k),
      dw: Math.round(rect.width * k),
      dh: Math.round(rect.height * k),
    };
  });

  return { width, height: Math.round(height), placements };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): a costura vira aritmetica pura, e a emenda do ultimo quadro fica coberta"
```

---

### Task 4: Páginas de teste e coleta de candidatos na página

**Files:**
- Create: `plugins/full-page-capture/test/fixtures/inner-scroll.html`
- Create: `plugins/full-page-capture/test/fixtures/sticky-header.html`
- Create: `plugins/full-page-capture/test/fixtures/lazy-load.html`
- Create: `plugins/full-page-capture/test/fixtures/very-tall.html`
- Create: `plugins/full-page-capture/src/content/main.js`
- Create: `plugins/full-page-capture/src/content/scroller.js`
- Modify: `plugins/full-page-capture/src/background.js`
- Modify: `plugins/full-page-capture/src/popup.js`

**Interfaces:**
- Consumes: `scoreCandidates()` de `src/lib/score-scrollers.mjs`.
- Produces:
  - `globalThis.__FPC.collect() → Array<Descriptor>` (definida em `content/scroller.js`), com o mesmo formato de descritor da Task 2. Guarda os elementos em `globalThis.__FPC.elements`, indexados por `id`.
  - `globalThis.__FPC.elementById(id) → Element`.
  - Mensagem `{ type: 'fpc:collect' }` do worker para o content, respondida com `{ descriptors, dpr, viewport: { width, height } }`. O `viewport` é consumido pela Task 7 e o `dpr` pela Task 8.
  - `ensureInjected(tabId) → Promise<void>` em `background.js`, que traduz a recusa de injeção em página protegida numa mensagem legível.

- [ ] **Step 1: Criar a página de teste do painel interno**

Criar `plugins/full-page-capture/test/fixtures/inner-scroll.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Painel interno</title>
    <style>
      html, body { height: 100%; margin: 0; overflow: hidden; font: 16px/1.5 system-ui, sans-serif; }
      .app { display: flex; height: 100vh; }
      .lateral { width: 240px; background: #1a1a1f; color: #ddd; overflow-y: auto; padding: 16px; }
      .conteudo { flex: 1; overflow-y: auto; padding: 24px; background: #f4f1ea; }
      .bloco { padding: 24px; margin-bottom: 16px; background: #fff; border: 1px solid #ddd; }
    </style>
  </head>
  <body>
    <div class="app">
      <nav class="lateral" id="lateral"></nav>
      <main class="conteudo" id="conteudo"></main>
    </div>
    <script>
      const conteudo = document.getElementById('conteudo');
      for (let i = 1; i <= 60; i++) {
        const bloco = document.createElement('div');
        bloco.className = 'bloco';
        bloco.textContent = `Bloco ${i} de 60 — o painel que rola é este, não a janela.`;
        conteudo.append(bloco);
      }
      const lateral = document.getElementById('lateral');
      for (let i = 1; i <= 40; i++) {
        const item = document.createElement('p');
        item.textContent = `Item lateral ${i}`;
        lateral.append(item);
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Criar a página de teste do cabeçalho grudento**

Criar `plugins/full-page-capture/test/fixtures/sticky-header.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Cabeçalho grudento</title>
    <style>
      body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f4f1ea; }
      header { position: sticky; top: 0; background: #111114; color: #fff; padding: 16px; z-index: 10; }
      .cookies { position: fixed; bottom: 0; left: 0; right: 0; background: #b4c636; color: #111; padding: 16px; }
      .chat { position: fixed; right: 24px; bottom: 96px; width: 64px; height: 64px; border-radius: 50%; background: #a85a30; }
      .bloco { padding: 32px; margin: 16px; background: #fff; border: 1px solid #ddd; }
    </style>
  </head>
  <body>
    <header>Cabeçalho que gruda no topo</header>
    <main id="main"></main>
    <div class="cookies">Aceita os cookies aí</div>
    <div class="chat"></div>
    <script>
      const main = document.getElementById('main');
      for (let i = 1; i <= 40; i++) {
        const bloco = document.createElement('div');
        bloco.className = 'bloco';
        bloco.textContent = `Bloco ${i} de 40 — o cabeçalho deve aparecer uma vez só.`;
        main.append(bloco);
      }
    </script>
  </body>
</html>
```

- [ ] **Step 3: Criar a página de teste do carregamento preguiçoso**

Criar `plugins/full-page-capture/test/fixtures/lazy-load.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Carregamento preguiçoso</title>
    <style>
      body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f4f1ea; }
      .cartao { height: 320px; margin: 16px; background: #fff; border: 1px solid #ddd; display: grid; place-items: center; }
      .cartao[data-carregado='sim'] { background: #dfe7c0; }
    </style>
  </head>
  <body>
    <main id="main"></main>
    <script>
      const main = document.getElementById('main');
      for (let i = 1; i <= 30; i++) {
        const cartao = document.createElement('div');
        cartao.className = 'cartao';
        cartao.textContent = `Cartão ${i} — vazio até entrar na tela`;
        main.append(cartao);
      }
      const observador = new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const alvo = entrada.target;
          setTimeout(() => {
            alvo.dataset.carregado = 'sim';
            alvo.textContent = `${alvo.textContent.split(' —')[0]} — carregado`;
          }, 400);
          observador.unobserve(alvo);
        }
      });
      document.querySelectorAll('.cartao').forEach((c) => observador.observe(c));
    </script>
  </body>
</html>
```

- [ ] **Step 4: Criar a página de teste muito comprida**

Criar `plugins/full-page-capture/test/fixtures/very-tall.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Muito comprida</title>
    <style>
      body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f4f1ea; }
      .faixa { height: 400px; display: grid; place-items: center; border-bottom: 1px solid #ccc; }
    </style>
  </head>
  <body>
    <main id="main"></main>
    <script>
      const main = document.getElementById('main');
      for (let i = 1; i <= 120; i++) {
        const faixa = document.createElement('div');
        faixa.className = 'faixa';
        faixa.textContent = `Faixa ${i} de 120 — total acima de 48.000 pixels`;
        main.append(faixa);
      }
    </script>
  </body>
</html>
```

- [ ] **Step 5: Escrever a coleta de candidatos**

Criar `plugins/full-page-capture/src/content/scroller.js`:

```js
(() => {
  const FPC = (globalThis.__FPC ||= {});
  const MIN_OVERFLOW = 200;

  function depthOf(el) {
    let depth = 0;
    let node = el;
    while ((node = node.parentElement)) depth += 1;
    return depth;
  }

  function visibleAreaOf(rect) {
    const largura = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const altura = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    return largura * altura;
  }

  function describe(el, id, isDocument) {
    const rect = isDocument
      ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
      : el.getBoundingClientRect();
    return {
      id,
      scrollHeight: el.scrollHeight,
      clientHeight: isDocument ? innerHeight : el.clientHeight,
      overflowY: isDocument ? 'visible' : getComputedStyle(el).overflowY,
      visibleArea: visibleAreaOf(rect),
      depth: isDocument ? 0 : depthOf(el),
      isDocument,
      label: isDocument ? 'a página inteira' : rotulo(el),
    };
  }

  function rotulo(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classe = el.classList[0] ? `.${el.classList[0]}` : '';
    return `${tag}${id}${classe}`;
  }

  FPC.elements = [];

  FPC.collect = () => {
    const raiz = document.scrollingElement || document.documentElement;
    FPC.elements = [raiz];
    const descritores = [describe(raiz, 0, true)];

    for (const el of document.body.querySelectorAll('*')) {
      if (el.hasAttribute('data-fpc-ui')) continue;
      if (el.scrollHeight - el.clientHeight < MIN_OVERFLOW) continue;
      const id = FPC.elements.length;
      FPC.elements.push(el);
      descritores.push(describe(el, id, false));
    }
    return descritores;
  };

  FPC.elementById = (id) => FPC.elements[id];
})();
```

- [ ] **Step 6: Escrever o roteador de mensagens do content**

Criar `plugins/full-page-capture/src/content/main.js`:

```js
(() => {
  const FPC = (globalThis.__FPC ||= {});
  if (FPC.ready) return;
  FPC.ready = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = FPC.handlers?.[message?.type];
    if (!handler) return false;
    Promise.resolve(handler(message))
      .then(sendResponse)
      .catch((error) => sendResponse({ erro: String(error?.message ?? error) }));
    return true;
  });

  FPC.handlers = {
    'fpc:collect': () => ({
      descriptors: FPC.collect(),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }),
  };
})();
```

Atenção à ordem de injeção: `scroller.js` define `FPC.collect` e `main.js` o consome dentro do handler, que só roda depois. Injetar `scroller.js` antes de `main.js`.

- [ ] **Step 7: Ligar a injeção e a pontuação no worker**

Substituir o conteúdo de `plugins/full-page-capture/src/background.js` por:

```js
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
      throw new Error('O Chrome não deixa capturar esta página. Vale para chrome://, a Web Store e a página de extensões.');
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
```

- [ ] **Step 8: Verificar nas páginas de teste**

Recarregar a extensão em `chrome://extensions`. Abrir cada arquivo com `file://` — antes disso, marcar "Permitir acesso a URLs de arquivo" na página da extensão.

```bash
open -a "Google Chrome" ~/Code/mscreative-plugins/plugins/full-page-capture/test/fixtures/inner-scroll.html
```

Esperado por página, ao clicar em "Capturar página":
- `inner-scroll.html` → `Alvo: main#conteudo`
- `sticky-header.html` → `Alvo: a página inteira`
- `very-tall.html` → `Alvo: a página inteira`

E numa página protegida, para conferir a mensagem traduzida: abrir `chrome://extensions` e clicar no ícone.

Esperado: `O Chrome não deixa capturar esta página. Vale para chrome://, a Web Store e a página de extensões.` — e nunca o erro cru do `executeScript`.

- [ ] **Step 9: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): a extensao passa a achar o painel que rola, e as quatro paginas de teste entram no repo"
```

---

### Task 5: Confirmação visual do alvo

**Files:**
- Create: `plugins/full-page-capture/src/content/overlay.js`
- Modify: `plugins/full-page-capture/src/content/main.js`
- Modify: `plugins/full-page-capture/src/background.js`

**Interfaces:**
- Consumes: `FPC.elementById(id)` da Task 4.
- Produces:
  - `FPC.confirm(candidatos) → Promise<{ id: number } | { cancelado: true }>`, definida em `content/overlay.js`. `candidatos` é a lista pontuada, já ordenada, com `id` e `label`.
  - Mensagem `{ type: 'fpc:confirm', candidates }`, respondida com o mesmo objeto.
  - A interface vive numa shadow root e todos os seus nós carregam o atributo `data-fpc-ui`, que a coleta e o congelamento ignoram.

- [ ] **Step 1: Escrever o overlay**

Criar `plugins/full-page-capture/src/content/overlay.js`:

```js
(() => {
  const FPC = (globalThis.__FPC ||= {});

  const CSS = `
    :host { all: initial; }
    .contorno {
      position: fixed; pointer-events: none; z-index: 2147483646;
      border: 2px solid #b4c636; background: rgba(180, 198, 54, 0.12);
      transition: all 120ms ease;
    }
    .caixa {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      display: flex; gap: 8px; align-items: center;
      padding: 12px 16px; border-radius: 10px;
      background: #111114; color: #b2a898;
      font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,.4);
    }
    .caixa strong { color: #f4f1ea; font-weight: 600; }
    button {
      font: inherit; padding: 6px 12px; border: 0; border-radius: 6px; cursor: pointer;
      background: #b2a898; color: #111114;
    }
    button.secundario { background: transparent; color: #b2a898; border: 1px solid #4a463f; }
  `;

  function montar() {
    const host = document.createElement('div');
    host.setAttribute('data-fpc-ui', '');
    const shadow = host.attachShadow({ mode: 'open' });
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    shadow.append(estilo);
    document.documentElement.append(host);
    return { host, shadow };
  }

  function posicionar(contorno, el, isDocument) {
    if (isDocument) {
      Object.assign(contorno.style, { left: '0px', top: '0px', width: `${innerWidth - 4}px`, height: `${innerHeight - 4}px` });
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(contorno.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width - 4}px`, height: `${r.height - 4}px` });
  }

  FPC.confirm = (candidatos) =>
    new Promise((resolve) => {
      const { host, shadow } = montar();
      let indice = 0;

      const contorno = document.createElement('div');
      contorno.className = 'contorno';
      const caixa = document.createElement('div');
      caixa.className = 'caixa';
      const texto = document.createElement('span');
      const sim = document.createElement('button');
      sim.textContent = 'Capturar';
      const trocar = document.createElement('button');
      trocar.className = 'secundario';
      trocar.textContent = 'Outro';
      const cancelar = document.createElement('button');
      cancelar.className = 'secundario';
      cancelar.textContent = 'Cancelar';
      caixa.append(texto, sim, trocar, cancelar);
      shadow.append(contorno, caixa);

      function pintar() {
        const atual = candidatos[indice];
        posicionar(contorno, FPC.elementById(atual.id), atual.isDocument);
        texto.innerHTML = `Capturar <strong>${atual.label}</strong>?`;
        trocar.style.display = candidatos.length > 1 ? '' : 'none';
      }

      function fechar(resultado) {
        removeEventListener('keydown', aoTeclar, true);
        host.remove();
        resolve(resultado);
      }

      function aoTeclar(evento) {
        if (evento.key === 'Escape') fechar({ cancelado: true });
        if (evento.key === 'Enter') fechar({ id: candidatos[indice].id });
      }

      sim.addEventListener('click', () => fechar({ id: candidatos[indice].id }));
      cancelar.addEventListener('click', () => fechar({ cancelado: true }));
      trocar.addEventListener('click', () => {
        indice = (indice + 1) % candidatos.length;
        pintar();
      });
      addEventListener('keydown', aoTeclar, true);

      pintar();
    });
})();
```

- [ ] **Step 2: Registrar o handler no roteador**

Em `plugins/full-page-capture/src/content/main.js`, substituir o bloco `FPC.handlers` por:

```js
  FPC.handlers = {
    'fpc:collect': () => ({
      descriptors: FPC.collect(),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }),
    'fpc:confirm': (message) => FPC.confirm(message.candidates),
  };
```

- [ ] **Step 3: Injetar o novo arquivo e pedir a confirmação**

Em `plugins/full-page-capture/src/background.js`, trocar a constante e o fim de `handleStart`:

```js
const CONTENT_FILES = [
  'src/content/scroller.js',
  'src/content/overlay.js',
  'src/content/main.js',
];
```

```js
  const escolha = await chrome.tabs.sendMessage(tabId, { type: 'fpc:confirm', candidates: ranked });
  if (escolha?.cancelado) return { message: 'Cancelado.' };
  const escolhido = ranked.find((c) => c.id === escolha.id);
  const name = buildFilename({ url: tab.url, title: tab.title, date: new Date() });
  return { message: `Alvo: ${escolhido.label} — sairia como ${name}` };
```

Depois desta troca, `handleStart` inteira fica assim — confira que a variável `alvo` da Task 4 sumiu e que `ranked` continua sendo usada:

```js
async function handleStart(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await ensureInjected(tabId);
  const { descriptors } = await chrome.tabs.sendMessage(tabId, { type: 'fpc:collect' });
  const ranked = scoreCandidates(descriptors);
  if (ranked.length === 0) throw new Error('Não achei nada que role nesta página.');
  const escolha = await chrome.tabs.sendMessage(tabId, { type: 'fpc:confirm', candidates: ranked });
  if (escolha?.cancelado) return { message: 'Cancelado.' };
  const escolhido = ranked.find((c) => c.id === escolha.id);
  const name = buildFilename({ url: tab.url, title: tab.title, date: new Date() });
  return { message: `Alvo: ${escolhido.label} — sairia como ${name}` };
}
```

- [ ] **Step 4: Verificar**

Recarregar a extensão, abrir `inner-scroll.html`, clicar em "Capturar página".

Esperado: o painel de conteúdo fica contornado em lima, a barra pergunta `Capturar main#conteudo?`. "Outro" alterna para a lateral e para a página inteira. `Esc` cancela e o popup mostra `Cancelado.`. "Capturar" fecha a barra e o popup mostra o alvo escolhido.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): o alvo acende na tela e pede confirmacao antes de virar imagem"
```

---

### Task 6: Congelar a página e esperar assentar

**Files:**
- Create: `plugins/full-page-capture/src/content/freeze.js`
- Create: `plugins/full-page-capture/src/content/settle.js`
- Modify: `plugins/full-page-capture/src/content/main.js`
- Modify: `plugins/full-page-capture/src/background.js`

**Interfaces:**
- Consumes: `FPC.elementById(id)` da Task 4.
- Produces:
  - `FPC.freeze() → void` — varre uma vez, guarda o estado original, desliga animação e rolagem suave, esconde as barras de rolagem. Não mexe nos fixos ainda.
  - `FPC.hideFixed() → void` — `position: fixed` vira `visibility: hidden`; `position: sticky` vira `position: static`. Nenhuma das duas altera o fluxo do layout, então a altura da página não muda no meio da captura.
  - `FPC.restore() → void` — devolve tudo. Idempotente.
  - `FPC.settle({ quietMs, timeoutMs }) → Promise<void>`.
  - Mensagens `{ type: 'fpc:freeze' }` e `{ type: 'fpc:restore' }`.

- [ ] **Step 1: Escrever o congelamento**

Criar `plugins/full-page-capture/src/content/freeze.js`:

```js
(() => {
  const FPC = (globalThis.__FPC ||= {});
  let guardados = null;
  let estiloGlobal = null;

  const CSS_GLOBAL = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
    ::-webkit-scrollbar { display: none !important; }
  `;

  FPC.freeze = () => {
    if (guardados) return;
    guardados = [];

    estiloGlobal = document.createElement('style');
    estiloGlobal.setAttribute('data-fpc-ui', '');
    estiloGlobal.textContent = CSS_GLOBAL;
    document.documentElement.append(estiloGlobal);

    for (const el of document.body.querySelectorAll('*')) {
      if (el.hasAttribute('data-fpc-ui')) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      guardados.push({
        el,
        pos,
        visibility: el.style.visibility,
        position: el.style.position,
      });
    }
  };

  FPC.hideFixed = () => {
    if (!guardados) return;
    for (const item of guardados) {
      if (item.pos === 'fixed') item.el.style.visibility = 'hidden';
      else item.el.style.position = 'static';
    }
  };

  FPC.restore = () => {
    if (!guardados) return;
    for (const item of guardados) {
      item.el.style.visibility = item.visibility;
      item.el.style.position = item.position;
    }
    guardados = null;
    estiloGlobal?.remove();
    estiloGlobal = null;
  };
})();
```

- [ ] **Step 2: Escrever a espera de assentamento**

Criar `plugins/full-page-capture/src/content/settle.js`:

```js
(() => {
  const FPC = (globalThis.__FPC ||= {});

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const doisQuadros = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  function naTela(img) {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  }

  function domQuieto(quietMs, tetoMs) {
    return new Promise((resolve) => {
      let relogio = setTimeout(fim, quietMs);
      const limite = setTimeout(fim, tetoMs);
      const observador = new MutationObserver(() => {
        clearTimeout(relogio);
        relogio = setTimeout(fim, quietMs);
      });
      observador.observe(document.body, { childList: true, subtree: true, attributes: true });

      function fim() {
        clearTimeout(relogio);
        clearTimeout(limite);
        observador.disconnect();
        resolve();
      }
    });
  }

  FPC.settle = async ({ quietMs = 250, timeoutMs = 2000 } = {}) => {
    const inicio = performance.now();
    await doisQuadros();

    const pendentes = [...document.images].filter((img) => naTela(img) && !img.complete);
    if (pendentes.length) {
      await Promise.race([
        Promise.allSettled(pendentes.map((img) => img.decode().catch(() => {}))),
        dormir(timeoutMs),
      ]);
    }

    const sobra = Math.max(0, timeoutMs - (performance.now() - inicio));
    await domQuieto(quietMs, sobra);
  };
})();
```

- [ ] **Step 3: Registrar os handlers**

Em `plugins/full-page-capture/src/content/main.js`, substituir o bloco `FPC.handlers` por:

```js
  FPC.handlers = {
    'fpc:collect': () => ({
      descriptors: FPC.collect(),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }),
    'fpc:confirm': (message) => FPC.confirm(message.candidates),
    'fpc:freeze': () => { FPC.freeze(); return { ok: true }; },
    'fpc:restore': () => { FPC.restore(); return { ok: true }; },
  };
```

- [ ] **Step 4: Injetar os novos arquivos**

Em `plugins/full-page-capture/src/background.js`, substituir a constante:

```js
const CONTENT_FILES = [
  'src/content/scroller.js',
  'src/content/overlay.js',
  'src/content/freeze.js',
  'src/content/settle.js',
  'src/content/main.js',
];
```

- [ ] **Step 5: Verificar à mão no console**

Recarregar a extensão, abrir `sticky-header.html`, clicar no ícone e capturar (para forçar a injeção). Depois, no console da própria página:

```js
__FPC.freeze(); __FPC.hideFixed();
```

Esperado: a barra de cookies e a bolinha de chat somem; o cabeçalho preto para de grudar e fica parado no topo do documento; a página **não** muda de altura (`document.scrollingElement.scrollHeight` é o mesmo antes e depois).

```js
__FPC.restore();
```

Esperado: tudo volta como estava.

- [ ] **Step 6: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): os fixos calam sem mexer no layout, e cada parada espera o conteudo assentar"
```

---

### Task 7: Documento offscreen que desenha e baixa

**Files:**
- Create: `plugins/full-page-capture/src/offscreen.html`
- Create: `plugins/full-page-capture/src/offscreen.js`
- Modify: `plugins/full-page-capture/src/background.js`

**Interfaces:**
- Consumes: `planStitch()` de `src/lib/plan-stitch.mjs`.
- Produces, todas por `chrome.runtime.sendMessage` com `alvo: 'offscreen'`:
  - `{ type: 'fpc:off:frame', index, dataUrl }` → `{ ok: true }`. Guarda o quadro como `ImageBitmap`.
  - `{ type: 'fpc:off:finish', plan, filename }` → `{ ok: true, filename }` ou `{ erro }`. Desenha, baixa e espera o download terminar antes de responder.
  - `{ type: 'fpc:off:reset' }` → `{ ok: true }`. Descarta os quadros guardados.
  - No worker: `ensureOffscreen() → Promise<void>` e `closeOffscreen() → Promise<void>`.

- [ ] **Step 1: Criar o documento offscreen**

Criar `plugins/full-page-capture/src/offscreen.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <script src="offscreen.js"></script>
  </body>
</html>
```

Criar `plugins/full-page-capture/src/offscreen.js`:

```js
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
    quadros.clear();
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
  const url = URL.createObjectURL(blob);
  try {
    const id = await chrome.downloads.download({ url, filename, saveAs: false });
    await esperarDownload(id);
    return { ok: true, filename };
  } finally {
    URL.revokeObjectURL(url);
    for (const bitmap of quadros.values()) bitmap.close();
    quadros.clear();
  }
}

function esperarDownload(id) {
  return new Promise((resolve, reject) => {
    function ouvir(delta) {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') {
        chrome.downloads.onChanged.removeListener(ouvir);
        resolve();
      }
      if (delta.state?.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(ouvir);
        reject(new Error('o download foi interrompido'));
      }
    }
    chrome.downloads.onChanged.addListener(ouvir);
  });
}
```

- [ ] **Step 2: Ensinar o worker a abrir e fechar o offscreen**

Em `plugins/full-page-capture/src/background.js`, adicionar o import e as duas funções, logo abaixo dos imports existentes:

```js
import { planStitch } from './lib/plan-stitch.mjs';

const OFFSCREEN_URL = 'src/offscreen.html';

async function ensureOffscreen() {
  const existentes = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
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
  const existentes = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (existentes.length > 0) await chrome.offscreen.closeDocument();
}
```

- [ ] **Step 3: Provar o caminho inteiro com um quadro só**

Primeiro, em `handleStart`, passar a colher `dpr` e `viewport` da coleta que já acontece. Trocar a linha da coleta por:

```js
  const { descriptors, dpr, viewport } = await chrome.tabs.sendMessage(tabId, { type: 'fpc:collect' });
```

Depois, substituir o fim de `handleStart` (a partir de `const escolha = ...`) por:

```js
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
    await chrome.runtime.sendMessage({ alvo: 'offscreen', type: 'fpc:off:frame', index: 0, dataUrl });
    const resposta = await chrome.runtime.sendMessage({
      alvo: 'offscreen', type: 'fpc:off:finish', plan, filename,
    });
    if (resposta?.erro) throw new Error(resposta.erro);
    return { message: `Salvo: ${filename}` };
  } finally {
    await closeOffscreen();
  }
```

- [ ] **Step 4: Verificar**

Recarregar a extensão, abrir `sticky-header.html`, capturar e confirmar.

Esperado: um PNG da primeira tela cai em Downloads com o nome padronizado, e o popup mostra `Salvo: 2026-08-13_....png`. A imagem tem exatamente o tamanho da janela.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): o documento offscreen desenha a costura e entrega o arquivo"
```

---

### Task 8: O laço de captura

**Files:**
- Modify: `plugins/full-page-capture/src/content/main.js`
- Modify: `plugins/full-page-capture/src/background.js`
- Modify: `plugins/full-page-capture/src/popup.js`

**Interfaces:**
- Consumes: `FPC.freeze()`, `FPC.hideFixed()`, `FPC.restore()`, `FPC.settle()` (Task 6); `FPC.elementById()` (Task 4); `planStitch()` (Task 3); `ensureOffscreen()`, `closeOffscreen()` (Task 7).
- Produces:
  - `FPC.step({ id, index }) → Promise<{ scrollTop, rect, fim, total }>` — rola o alvo para a parada `index`, mede a rolagem efetiva, esconde os fixos a partir do segundo quadro, espera assentar e devolve o retângulo do alvo em pixels CSS. `fim` é `true` quando a rolagem chegou ao fundo; `total` é o `scrollHeight` do alvo no momento da parada, remedido a cada passo porque a página pode crescer.
  - Mensagem `{ type: 'fpc:step', id, index }`.
  - Progresso do worker para o popup: `chrome.runtime.sendMessage({ type: 'fpc:progress', atual, total })`.

- [ ] **Step 1: Escrever o passo no content**

Em `plugins/full-page-capture/src/content/main.js`, adicionar antes do bloco `FPC.handlers`:

```js
  FPC.step = async ({ id, index }) => {
    const el = FPC.elementById(id);
    const isDocument = el === (document.scrollingElement || document.documentElement);
    const alturaVisivel = isDocument ? innerHeight : el.clientHeight;
    const alvoTop = index * alturaVisivel;

    el.scrollTop = alvoTop;
    if (index > 0) FPC.hideFixed();
    await FPC.settle();

    const scrollTop = el.scrollTop;
    const total = el.scrollHeight;
    const r = isDocument
      ? { x: 0, y: 0, width: innerWidth, height: innerHeight }
      : (() => {
          const b = el.getBoundingClientRect();
          return {
            x: Math.max(0, b.left),
            y: Math.max(0, b.top),
            width: Math.min(b.width, innerWidth - Math.max(0, b.left)),
            height: Math.min(b.height, innerHeight - Math.max(0, b.top)),
          };
        })();

    const fim = scrollTop + alturaVisivel >= total - 1;
    return { scrollTop, rect: r, fim, total };
  };
```

E substituir o bloco `FPC.handlers` por:

```js
  FPC.handlers = {
    'fpc:collect': () => ({
      descriptors: FPC.collect(),
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
    }),
    'fpc:confirm': (message) => FPC.confirm(message.candidates),
    'fpc:freeze': () => { FPC.freeze(); return { ok: true }; },
    'fpc:restore': () => { FPC.restore(); return { ok: true }; },
    'fpc:step': (message) => FPC.step(message),
  };
```

- [ ] **Step 2: Escrever o laço no worker**

Em `plugins/full-page-capture/src/background.js`, adicionar as constantes e utilitários no topo, abaixo dos imports:

```js
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
    throw new Error('Você mudou de aba. O Chrome só fotografa a aba ativa — não troque durante a captura.');
  }
}

function avisar(atual, total) {
  chrome.runtime.sendMessage({ type: 'fpc:progress', atual, total }).catch(() => {});
}
```

- [ ] **Step 3: Trocar o corpo de `handleStart` pelo laço completo**

Substituir tudo a partir de `const escolha = ...` em `handleStart` por:

```js
  const escolha = await chrome.tabs.sendMessage(tabId, { type: 'fpc:confirm', candidates: ranked });
  if (escolha?.cancelado) return { message: 'Cancelado.' };

  const filename = buildFilename({ url: tab.url, title: tab.title, date: new Date() });

  await ensureOffscreen();
  await chrome.tabs.sendMessage(tabId, { type: 'fpc:freeze' });

  const paradas = [];
  let truncado = false;
  let avisoTamanho = null;
  try {
    let anterior = -1;
    for (let index = 0; index < MAX_TELAS; index++) {
      await conferirAbaAtiva(tabId, tab.windowId);
      const parada = await chrome.tabs.sendMessage(tabId, { type: 'fpc:step', id: escolha.id, index });
      if (index > 0 && parada.scrollTop <= anterior) break;
      anterior = parada.scrollTop;

      const dataUrl = await capturarComRetentativa(tab.windowId);
      await chrome.runtime.sendMessage({
        alvo: 'offscreen', type: 'fpc:off:frame', index: paradas.length, dataUrl,
      });
      paradas.push({ scrollTop: parada.scrollTop, rect: parada.rect });
      avisar(paradas.length, Math.ceil(parada.total / Math.max(parada.rect.height, 1)));

      if (parada.fim) break;
      if (index === MAX_TELAS - 1) truncado = true;
      await dormir(INTERVALO_MINIMO_MS);
    }
  } finally {
    await chrome.tabs.sendMessage(tabId, { type: 'fpc:restore' }).catch(() => {});
  }

  try {
    const plan = planStitch(paradas, { dpr, scale: 1 });
    const resposta = await chrome.runtime.sendMessage({
      alvo: 'offscreen', type: 'fpc:off:finish', plan, filename,
    });
    if (resposta?.erro) throw new Error(resposta.erro);
  } finally {
    await closeOffscreen();
  }

  const limite = truncado ? ` (parei em ${MAX_TELAS} telas — a página continua além disso)` : '';
  return { message: `Salvo: ${filename}${limite}` };
```

O `dpr` e o `viewport` já vieram da coleta do começo de `handleStart` (Task 7, Step 3) — não chamar `fpc:collect` de novo. A variável `avisoTamanho` fica declarada e sem uso até a Task 9, que a preenche.

- [ ] **Step 4: Mostrar o progresso no popup**

Em `plugins/full-page-capture/src/popup.js`, adicionar antes do `startButton.addEventListener`:

```js
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'fpc:progress') return;
  setStatus(`Tela ${message.atual} de ${message.total}...`);
});
```

- [ ] **Step 5: Verificar nas quatro páginas de teste**

Recarregar a extensão e capturar cada uma:

- `inner-scroll.html` → o PNG mostra os 60 blocos do painel de conteúdo, **sem** a barra lateral, e sem emenda visível entre as telas.
- `sticky-header.html` → o cabeçalho preto aparece **uma vez**, no topo. A barra de cookies verde e a bolinha de chat aparecem só no primeiro quadro. Nenhum dos dois se repete.
- `lazy-load.html` → todos os 30 cartões saem no estado `carregado`, sem retângulo vazio.
- `very-tall.html` → sai um PNG muito comprido ou uma mensagem de truncamento honesta (o limite de canvas vira Task 9).

Para conferir a emenda, abrir o PNG e dar zoom nas junções.

- [ ] **Step 6: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): o laco de captura fecha e a pagina inteira vira um PNG so"
```

---

### Task 9: Limites de tamanho e resolução simples

**Files:**
- Create: `plugins/full-page-capture/src/lib/canvas-limits.mjs`
- Test: `plugins/full-page-capture/test/canvas-limits.test.mjs`
- Modify: `plugins/full-page-capture/src/background.js`

**Interfaces:**
- Consumes: nada.
- Produces: `chooseScale({ width, height, dpr }) → { scale: number, truncar: boolean, aviso: string | null }`.
  - `width` e `height` são a largura do alvo e a altura total do conteúdo, em pixels CSS.
  - Devolve `scale: 1` quando cabe na resolução nativa; `scale: 1/dpr` quando só cabe reduzido; `truncar: true` quando nem reduzido cabe.
  - Limites do Chrome, como constantes exportadas: `MAX_DIMENSION = 65535`, `MAX_AREA = 268435456`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `plugins/full-page-capture/test/canvas-limits.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseScale, MAX_AREA } from '../src/lib/canvas-limits.mjs';

test('página comum cabe em resolução nativa', () => {
  const r = chooseScale({ width: 1200, height: 8000, dpr: 2 });
  assert.equal(r.scale, 1);
  assert.equal(r.truncar, false);
  assert.equal(r.aviso, null);
});

test('página grande demais em retina cai para resolução simples', () => {
  const r = chooseScale({ width: 1600, height: 60000, dpr: 2 });
  assert.equal(r.scale, 0.5);
  assert.equal(r.truncar, false);
  assert.match(r.aviso, /resolução simples/);
});

test('página que nem reduzida cabe é truncada com aviso', () => {
  const r = chooseScale({ width: 3000, height: 300000, dpr: 2 });
  assert.equal(r.truncar, true);
  assert.match(r.aviso, /cortei/i);
});

test('altura acima da dimensão máxima força redução', () => {
  const r = chooseScale({ width: 800, height: 40000, dpr: 2 });
  assert.equal(r.scale, 0.5);
});

test('a área nativa no limite ainda passa', () => {
  const lado = Math.floor(Math.sqrt(MAX_AREA));
  const r = chooseScale({ width: lado, height: lado, dpr: 1 });
  assert.equal(r.scale, 1);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/canvas-limits.test.mjs
```

Esperado: FAIL com `Cannot find module .../src/lib/canvas-limits.mjs`.

- [ ] **Step 3: Implementar `canvas-limits.mjs`**

Criar `plugins/full-page-capture/src/lib/canvas-limits.mjs`:

```js
export const MAX_DIMENSION = 65535;
export const MAX_AREA = 268435456;

function cabe(width, height, k) {
  const w = width * k;
  const h = height * k;
  return h <= MAX_DIMENSION && w <= MAX_DIMENSION && w * h <= MAX_AREA;
}

export function chooseScale({ width, height, dpr = 1 }) {
  if (cabe(width, height, dpr)) {
    return { scale: 1, truncar: false, aviso: null };
  }
  if (dpr > 1 && cabe(width, height, 1)) {
    return {
      scale: 1 / dpr,
      truncar: false,
      aviso: 'A página é grande demais para a resolução nativa. Salvei em resolução simples.',
    };
  }
  return {
    scale: dpr > 1 ? 1 / dpr : 1,
    truncar: true,
    aviso: 'A página passa do limite de imagem do navegador. Cortei no máximo possível.',
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: `# fail 0`.

- [ ] **Step 5: Ligar no laço**

Em `plugins/full-page-capture/src/background.js`, adicionar o import:

```js
import { chooseScale, MAX_DIMENSION } from './lib/canvas-limits.mjs';
```

Trocar a linha do `planStitch` no fim de `handleStart` por:

```js
    const ultima = paradas[paradas.length - 1];
    const alturaTotal = ultima.scrollTop + ultima.rect.height;
    const { scale, truncar, aviso } = chooseScale({
      width: ultima.rect.width,
      height: alturaTotal,
      dpr,
    });
    avisoTamanho = aviso;
    const plan = planStitch(paradas, { dpr, scale });
    if (truncar) {
      plan.height = Math.min(plan.height, MAX_DIMENSION);
    }
```

A variável `avisoTamanho` já foi declarada na Task 8, junto de `truncado`. E trocar a linha final da função por:

```js
  const limite = truncado ? ` (parei em ${MAX_TELAS} telas — a página continua além disso)` : '';
  const extra = avisoTamanho ? ` ${avisoTamanho}` : '';
  return { message: `Salvo: ${filename}${limite}${extra}` };
```

- [ ] **Step 6: Verificar**

Recarregar a extensão e capturar `very-tall.html` (48.000 pixels de altura).

Esperado num monitor retina: o arquivo sai e o popup avisa que salvou em resolução simples. Nenhum arquivo cortado sem aviso.

- [ ] **Step 7: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture
git commit -m "feat(full-page-capture): a pagina gigante avisa antes de encolher, e nunca corta calada"
```

---

### Task 10: Documentação e entrada no repo

**Files:**
- Create: `plugins/full-page-capture/README.md`
- Create: `plugins/full-page-capture/PRIVACY.md`
- Create: `plugins/full-page-capture/LICENSE`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: o plugin pronto das Tasks 1 a 9.
- Produces: nada de código.

- [ ] **Step 1: Copiar a licença**

```bash
cd ~/Code/mscreative-plugins
cp plugins/instagram-carousel-transcriber/LICENSE plugins/full-page-capture/LICENSE
```

- [ ] **Step 2: Escrever o README do plugin**

Criar `plugins/full-page-capture/README.md`:

```markdown
# Captura de Página Inteira

Extensão Chrome (Manifest V3, MIT) que fotografa a página inteira e entrega um PNG. Feita para as páginas em que as outras falham.

## Por que existe

Capturador de página inteira já existe e é grátis. Este resolve três casos que os outros erram:

1. **Painel interno.** Em Gmail, Notion, Slack e painéis administrativos, quem rola é um `div` dentro da página, não a janela. Esta extensão acha o painel certo, destaca ele na tela e pergunta antes de capturar.
2. **Cabeçalho fixo repetido.** O cabeçalho aparece uma vez, no topo. Barra de cookies, widget de chat e botão flutuante entram só no primeiro quadro e somem do resto.
3. **Carregamento preguiçoso.** A cada parada, a extensão espera as imagens carregarem e o conteúdo assentar. Lista virtualizada não deixa buraco, porque cada tela é fotografada de verdade em vez de reconstruída.

## Instalar

```bash
git clone https://github.com/1marcelserrano/mscreative-plugins.git
```

Abra `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e aponte para `plugins/full-page-capture/`.

## Usar

Clique no ícone e depois em **Capturar página**. O painel que vai ser capturado acende em lima e a barra pergunta. `Enter` confirma, `Esc` cancela, **Outro** troca de alvo.

O arquivo cai em Downloads como `2026-08-13_notion-so_titulo-da-pagina.png`.

Enquanto captura, **não troque de aba** — o Chrome só fotografa a aba que está na frente, e a extensão aborta com aviso se você sair.

## Limites conhecidos

- **Conteúdo que é fixo.** Se o que você quer capturar é um pop-up aberto ou um leitor embutido em `position: fixed`, ele some a partir da segunda tela. A extensão trata elemento fixo como enfeite, não como conteúdo.
- **Rolagem infinita.** Para em 60 telas e avisa onde parou.
- **Página gigante.** Acima do limite de imagem do navegador, salva em resolução simples e avisa. Passando disso, corta — e diz que cortou.
- **Páginas do próprio Chrome.** `chrome://`, a Web Store e a página de extensões não aceitam injeção. Isso é regra do navegador.

## Desenvolvimento

```bash
node --test plugins/full-page-capture/test/
```

As quatro páginas de `test/fixtures/` reproduzem os casos difíceis: painel interno, cabeçalho grudento, carregamento preguiçoso e página muito comprida.
```

- [ ] **Step 3: Escrever o PRIVACY**

Criar `plugins/full-page-capture/PRIVACY.md`:

```markdown
# Privacidade

**Nada sai da sua máquina.**

A extensão fotografa a aba que está na sua frente, costura os pedaços num arquivo e baixa. Tudo acontece dentro do seu navegador.

- Sem servidor. Sem backend. Sem API.
- Sem analytics, sem telemetria, sem identificador.
- Sem chave de API, porque não existe serviço para chamar.
- Não guarda nada: a extensão não usa `chrome.storage` nem grava dados fora do arquivo que você baixa.

## Permissões e por quê

- `activeTab` — fotografar a aba atual, só depois de você clicar no ícone.
- `scripting` — injetar o código de captura na aba, sob demanda. Nada roda em site nenhum enquanto você não clica.
- `downloads` — salvar o PNG.
- `offscreen` — desenhar a imagem final, porque o Manifest V3 não deixa fazer isso no processo de fundo.

Não há `host_permissions`: a extensão não tem acesso permanente a domínio nenhum.

## Desinstalar

`chrome://extensions` → Remover. Não sobra nada.
```

- [ ] **Step 4: Registrar na vitrine do repo**

Em `README.md` (raiz), adicionar esta linha à tabela de plugins, logo abaixo da linha do `instagram-carousel-transcriber`:

```markdown
| [`full-page-capture`](./plugins/full-page-capture/) | v0.1.0 | Fotografa a página inteira, inclusive quando quem rola é um painel interno. Cabeçalho fixo aparece uma vez, carregamento preguiçoso não deixa buraco. | Extensão Chrome (MV3) |
```

E adicionar esta seção logo depois do bloco `### instagram-carousel-transcriber`:

```markdown
### `full-page-capture`

Extensão Chrome (Manifest V3, MIT) que captura a página inteira em um PNG e funciona onde as outras falham.

- **Acha quem rola de verdade.** Em Gmail, Notion e painéis administrativos, quem rola é um `div`, não a janela. A extensão detecta o painel, destaca na tela e pergunta antes de capturar.
- **Cabeçalho fixo aparece uma vez.** Barra de cookies e widget de chat não se repetem ao longo da imagem.
- **Espera o conteúdo carregar** a cada parada, então carregamento preguiçoso e lista virtualizada não deixam buraco.
- 100% local, sem servidor e sem `host_permissions`.
```

- [ ] **Step 5: Registrar no CHANGELOG**

Em `CHANGELOG.md`, adicionar no topo da lista de versões:

```markdown
## full-page-capture 0.1.0 — 2026-08-13

- Primeira versão. Captura de página inteira por costura de rolagem.
- Detecta o container que realmente rola e confirma o alvo antes de capturar.
- Elementos fixos e grudentos entram só no primeiro quadro.
- Espera o conteúdo assentar a cada parada.
- Limites de tamanho e de telas com aviso explícito, nunca truncamento silencioso.
```

- [ ] **Step 6: Rodar os testes uma última vez**

```bash
cd ~/Code/mscreative-plugins && node --test plugins/full-page-capture/test/
```

Esperado: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
cd ~/Code/mscreative-plugins
git add plugins/full-page-capture README.md CHANGELOG.md
git commit -m "docs(full-page-capture): o plugin entra na vitrine com limites conhecidos escritos"
```

---

## Pendências fora deste plano

- **Ícones.** O manifesto não declara `icons` nem `action.default_icon`, então o Chrome usa o ícone genérico. Arte antes de qualquer listagem pública.
- **Atalho de teclado** (`chrome.commands`).
- **PDF paginado, área de transferência e `.md` com metadados** — cortados na spec por YAGNI.
- **Listagem na Chrome Web Store.**
