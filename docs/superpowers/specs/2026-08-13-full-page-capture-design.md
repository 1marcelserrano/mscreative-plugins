# full-page-capture — design

**Data:** 2026-08-13
**Repo:** `1marcelserrano/mscreative-plugins`
**Pasta de destino:** `plugins/full-page-capture/`
**Slug:** `full-page-capture` · **Nome de exibição:** Captura de Página Inteira
**Status:** design aprovado, aguardando plano de implementação

---

## 1. Problema

Extensões de captura de página inteira já existem e são grátis. O GoFullPage é o padrão de fato. Construir só se justifica pelas páginas em que ele falha — e falha em três situações que aparecem justamente nos aplicativos onde a captura importa:

1. **Painel interno.** A janela não rola; quem rola é um `div` dentro da página. Gmail, Notion, Slack, dashboards e painéis administrativos funcionam assim. Um capturador que observa o scroll da janela fotografa a primeira tela e para.
2. **Elemento fixo repetido.** Cabeçalho grudento, barra de cookies, widget de chat e botão flutuante entram em todos os pedaços costurados. A mesma barra aparece seis vezes ao longo da imagem.
3. **Carregamento preguiçoso e lista virtualizada.** Conteúdo que só carrega ao rolar deixa buracos brancos. Lista virtualizada descarta do DOM o item que saiu da tela.

O plugin existe para resolver essas três. Não é um clone de conveniência.

## 2. Escopo

**Dentro:**
- Extensão Chrome Manifest V3, JavaScript puro, sem etapa de build e sem npm em tempo de execução.
- Detecção automática do elemento que rola, com confirmação visual e troca manual do alvo.
- Neutralização de elementos fixos e grudentos durante a captura.
- Espera pelo assentamento do conteúdo a cada parada.
- Saída: **um arquivo PNG**, nome padronizado, via `chrome.downloads`.
- Testes automatizados nas três funções puras; páginas de teste versionadas para verificação manual.

**Fora (YAGNI, decidido explicitamente):**
- PDF paginado.
- Cópia para a área de transferência.
- Arquivo `.md` com metadados.
- Captura de região por seleção retangular.
- Firefox e Safari. O alvo é Chrome e derivados de Chromium no desktop, igual ao outro plugin do repo.

## 3. Decisões e por quê

| # | Decisão | Razão |
|---|---|---|
| D1 | Motor = costura por rolagem com `chrome.tabs.captureVisibleTab` | Fotografa o que o Chrome pintou. Preserva canvas, WebGL, vídeo, iframe de outro domínio e shadow DOM. Imune a lista virtualizada por construção. Permissões modestas. |
| D2 | Descartado: DOM redesenhado em canvas (html2canvas e similares) | Repinta em vez de fotografar. Fonte, filtro CSS, `backdrop-blur`, `<video>`, canvas com CORS e iframe externo saem errados — exatamente nos aplicativos-alvo. Some ~200 KB de vendor. |
| D3 | Descartado: `chrome.debugger` + `captureBeyondViewport` | Exige a permissão `debugger`, que estampa a faixa "uma extensão está depurando este navegador" e endurece a revisão na Web Store. Além disso não enxerga painel interno nem força carregamento preguiçoso: resolve o caso fácil. |
| D4 | Alvo detectado automaticamente, com confirmação antes de capturar | Acerta a maioria dos casos sem exigir trabalho, e nunca captura a coisa errada em silêncio. |
| D5 | Elementos fixos aparecem no primeiro quadro e somem dos demais | A imagem fica igual à página real, só que inteira, sem a barra repetida. |
| D6 | Costura posicionada pela rolagem **efetiva**, não pela pretendida | Página que trava no fim, que usa `scroll-snap` ou que anda menos que o pedido continua alinhada. O último quadro se sobrepõe ao anterior e cobre a sobra. |
| D7 | Costura desenhada num documento offscreen; o plano da costura é calculado no service worker | O MV3 removeu `URL.createObjectURL` e `FileReader` do service worker. Separar *calcular* de *desenhar* mantém a aritmética testável fora do navegador. |
| D8 | A coleta acontece no content script; a decisão acontece no service worker | Content script não aceita módulos ES. Deixar a pontuação no worker (que é `type: "module"`) permite importar a mesma função em `node --test`. |
| D9 | Content script injetado sob demanda, não declarado no manifesto | Nada roda em site nenhum até você clicar no ícone. Melhor para privacidade e para a revisão da Web Store. |
| D10 | Truncamento nunca é silencioso | Bateu no limite de telas ou no limite de canvas do navegador, o plugin diz. |

## 4. Arquitetura

```
plugins/full-page-capture/
├── manifest.json
├── README.md
├── PRIVACY.md
├── LICENSE
├── icons/{icon16,icon48,icon128}.png
├── src/
│   ├── background.js          # service worker — maestro
│   ├── popup.html / popup.js / styles.css
│   ├── offscreen.html / offscreen.js   # desenha a costura, gera o object URL
│   ├── lib/                   # ESM puro, sem DOM, importável pelo node --test
│   │   ├── plan-stitch.js
│   │   ├── score-scrollers.js
│   │   └── filename.js
│   └── content/               # injetado sob demanda, namespace globalThis.__FPC
│       ├── main.js            # roteador de mensagens
│       ├── scroller.js        # coleta descritores dos candidatos
│       ├── overlay.js         # destaque e confirmação do alvo
│       ├── freeze.js          # cala os fixos, guarda e restaura o estado
│       └── settle.js          # espera o conteúdo assentar
└── test/
    ├── plan-stitch.test.js
    ├── score-scrollers.test.js
    ├── filename.test.js
    └── fixtures/{inner-scroll,sticky-header,lazy-load,very-tall}.html
```

**Regra de fronteira:** o content script nunca fotografa e nunca decide; o service worker nunca toca no DOM.

### Responsabilidades

- **`background.js`** — recebe o pedido do popup, injeta o content script, pontua os candidatos, roda o laço parada→foto, monta o plano da costura, aciona o documento offscreen e baixa o arquivo. Dono do estado da sessão de captura.
- **`content/scroller.js`** — percorre o DOM e devolve, para cada candidato, um descritor: `{id, scrollHeight, clientHeight, overflowY, rect, visibleArea, depth}`. Não decide nada.
- **`content/overlay.js`** — desenha o contorno sobre o candidato vencedor com "capturar este painel?" e o botão de trocar. No modo de troca, os candidatos acendem sob o cursor. Vive numa shadow root própria para não herdar o CSS da página.
- **`content/freeze.js`** — identifica em uma varredura os elementos `position: fixed` e `position: sticky`, guarda o estilo original num mapa, desliga animação e `scroll-behavior`, esconde as barras de rolagem. Expõe `hideFixed()`, `showFixed()` e `restore()`. O `restore()` roda em `finally`, inclusive em caso de erro.
- **`content/settle.js`** — aguarda as imagens do viewport resolverem `decode()` e o `MutationObserver` ficar quieto por 250 ms, desistindo em 2 s.
- **`lib/score-scrollers.js`** — `scoreCandidates(descriptors) → candidatos ordenados`. Função pura.
- **`lib/plan-stitch.js`** — `planStitch(stops, {dpr, scale}) → {width, height, placements[]}`. Função pura, aritmética apenas.
- **`lib/filename.js`** — `buildFilename({url, title, date}) → string`. Função pura.
- **`offscreen.js`** — recebe o plano e os quadros, desenha no canvas, devolve um object URL.

## 5. Fluxo de captura

1. Popup pede a captura. O worker injeta os arquivos de `content/` na aba ativa.
2. `scroller.js` coleta os descritores; o worker roda `scoreCandidates()` e devolve o vencedor mais a lista.
3. `overlay.js` destaca o vencedor e espera a confirmação. Trocar o alvo repete este passo.
4. O worker checa o limite: `alturaTotal × dpr` contra o teto de canvas do Chrome. Estourando, o popup oferece capturar em **resolução simples** — cada quadro reduzido por `1/dpr`, via o parâmetro `scale` de `planStitch()` — antes de começar.
5. `freeze.js` congela a página. Os fixos continuam visíveis para o primeiro quadro.
6. Laço, por parada:
   a. o content rola o alvo para a posição pretendida;
   b. mede a rolagem **efetiva**;
   c. do segundo quadro em diante, `hideFixed()`;
   d. `settle.js` espera o conteúdo assentar;
   e. o content avisa o worker com `{scrollTopReal, rect, dpr}`;
   f. o worker chama `captureVisibleTab` respeitando o intervalo mínimo e guarda o quadro.
7. Fim do laço quando a posição efetiva para de avançar, ou no limite de telas.
8. O worker monta o plano com `planStitch()` e manda plano e quadros ao documento offscreen.
9. O offscreen desenha, devolve o object URL, o worker baixa com o nome de `buildFilename()`.
10. `restore()` devolve a página ao estado original. Sempre.

**Nome do arquivo:** `AAAA-MM-DD_dominio_titulo-da-pagina.png`, com o título em slug e cortado em 60 caracteres. Exemplo: `2026-08-13_notion-so_plano-editorial-agosto.png`.

## 6. Erros e limites

| Situação | Comportamento |
|---|---|
| Usuário troca de aba durante a captura | Aborta com aviso no popup. O `captureVisibleTab` só fotografa a aba ativa. |
| Limite de taxa do `captureVisibleTab` (2 por segundo) | Intervalo mínimo de 500 ms entre fotos e nova tentativa com espera ao receber erro de cota. |
| Página cresce durante a captura (rolagem infinita) | Altura remedida a cada parada. Teto de 60 telas. Ao bater no teto, o arquivo sai e o popup informa onde parou. |
| Altura acima do limite de canvas do Chrome | Detectado antes de começar. O popup oferece resolução simples. Persistindo, corta no limite e informa. |
| Página sem elemento rolável | Alvo é a janela. Página de uma tela vira captura de uma tela, sem erro. |
| Erro em qualquer ponto | `restore()` em `finally`. A página nunca fica com o cabeçalho escondido depois de uma falha. |
| Página protegida (`chrome://`, Web Store) | Injeção falha; popup explica que o Chrome não permite naquela página. |
| Conteúdo principal é um elemento fixo (modal aberto, leitor embutido) | **Limite conhecido, aceito neste ciclo.** O `freeze.js` esconde todo `fixed` e `sticky` do segundo quadro em diante, então esse conteúdo some da captura. Documentado no README do plugin; tratar só se aparecer na prática. |

## 7. Verificação

**Automatizada** — `node --test`, sem dependência alguma:
- `plan-stitch.test.js` — sobreposição no último quadro, passo curto, recorte por retângulo, densidade de pixel 1× e 2×, quadro único.
- `score-scrollers.test.js` — painel interno vence a barra lateral; página comum cai na janela; elemento oculto não pontua.
- `filename.test.js` — acentos, título vazio, título longo, caracteres inválidos no sistema de arquivos.

**Manual, guiada por checklist no README** — as quatro páginas de `test/fixtures/`, uma por inimigo, mais uma passada em Notion e Gmail.

**CI** — workflow em `.github/workflows/test.yml` rodando `node --test` a cada push. O repo ainda não tem workflow nenhum.

## 8. Entrega

- `manifest.json` com `permissions: ["activeTab", "downloads", "scripting", "offscreen"]` e nenhum `host_permissions` fixo. Sem `storage`: o plugin não guarda preferência nenhuma neste ciclo.
- `README.md` do plugin no padrão da casa: o que faz, por que existe, como instalar, limites conhecidos.
- `PRIVACY.md`: nada sai da máquina, sem servidor, sem analytics, sem chave de API.
- Entrada no `README.md` da raiz e no `CHANGELOG.md`, versão `0.1.0`.

## 9. Fora deste ciclo

Anotado, não construído: PDF paginado, área de transferência, `.md` com metadados, seleção de região, atalho de teclado, listagem na Chrome Web Store.
