# Transcritor de Carrossel do Instagram

**Leia todos os slides de um carrossel do Instagram e baixe um único `.md`. OCR local por padrão; modo Claude opcional pra qualidade alta.**

Extensão Chrome (Manifest V3), open-source (MIT). Você abre um carrossel, clica num botão, e recebe um Markdown com o texto de cada slide mais a legenda original.

🇧🇷 Português abaixo · 🇺🇸 [English below](#english)

---

## Como funciona

1. Você abre um post (`/p/...`) ou reel (`/reel/...`) do Instagram, logado na sua conta.
2. Clica no ícone da extensão → "Transcrever carrossel".
3. A extensão percorre os slides, lê o texto de cada um e baixa um `.md`.

Por padrão o OCR roda 100% local com [Tesseract.js](https://tesseract.projectnaptha.com/) — nenhuma imagem sai da sua máquina, sem API paga, sem backend. Quer qualidade alta em slides estilizados? Ligue o [modo Claude](#modo-claude-opcional).

## Instalar (modo desenvolvedor)

Ainda não está na Chrome Web Store. Instale via "Load unpacked":

1. Baixe ou clone esta pasta (`instagram-carousel-transcriber/`).
2. Se a pasta `vendor/` vier sem os binários do Tesseract, rode dentro dela:
   ```bash
   cd vendor && bash FETCH.sh
   ```
   Isso baixa o motor de OCR (≈9 MB) que precisa estar embarcado — a CSP do Manifest V3 proíbe carregar de CDN em tempo de execução.
3. Abra `chrome://extensions` no Chrome.
4. Ligue o **Modo do desenvolvedor** (canto superior direito).
5. Clique em **Carregar sem compactação** e selecione a pasta `instagram-carousel-transcriber/`.
6. Fixe a extensão na barra.

**Verificar:** abra um carrossel, clique no ícone, clique em **Transcrever carrossel**. A barra de progresso anda e o `.md` baixa. Se travar, recarregue a extensão (botão ↻ em `chrome://extensions`) e tente de novo — o Chrome não pega edição de arquivo sem reload.

## Usar

1. Abra um carrossel do Instagram.
2. Clique no ícone da extensão.
3. Clique em **Transcrever carrossel** e acompanhe a barra de progresso.
4. O arquivo `carrossel_<shortcode>.md` baixa sozinho.

### Formato do arquivo

```markdown
# Transcrição — Carrossel @autor
> Fonte: <url> · Slides: N · Motor: Tesseract · Gerado: 2026-06-18

## Slide 1
<texto lido do slide>

## Slide 2
<texto lido do slide>

---
## Legenda original
<legenda do post>
```

O campo **Motor** diz como o arquivo foi gerado — `Tesseract` (local) ou `Claude`.

## Modo Claude (opcional)

O Tesseract é grátis e local, mas tropeça em texto estilizado sobre foto — exatamente o que carrossel de marketing costuma ter. O modo Claude usa a visão do [Claude](https://www.anthropic.com/claude) pra ler esses slides muito melhor, com a **sua própria chave** da Anthropic.

**Como ligar:**

1. Pegue uma chave em [console.anthropic.com](https://console.anthropic.com) (formato `sk-ant-...`).
2. Em `chrome://extensions`, abra **Detalhes** da extensão → **Opções da extensão** (ou botão direito no ícone → **Opções**).
3. Marque **Modo Claude**, cole a chave, escolha o modelo e clique em **Salvar**.
4. Transcreva normalmente. O status passa a dizer "Claude no slide X de N…" e o `.md` sai com `Motor: Claude`.

**Modelos e custo** (por carrossel de ~15 slides, com a sua chave):

| Modelo | Custo aprox. | Quando usar |
|---|---|---|
| `claude-haiku-4-5` | ~US$ 0,03 | Padrão. Já lê muito melhor que o Tesseract. |
| `claude-opus-4-8` | ~US$ 0,15 | Quando você quer a melhor leitura possível. |

A chave fica só na sua máquina (`chrome.storage.local`), nunca sai pra lugar nenhum além da API da Anthropic na hora da transcrição. Desligou o modo Claude? Volta tudo a rodar local. Veja a [privacidade](#privacidade) dos dois modos.

## Limitações

- **OCR erra.** Fontes muito estilizadas, texto sobre fundo de baixo contraste ou tipografia decorativa podem sair com erros no modo Tesseract. Por isso a **legenda original entra sempre** no arquivo, como complemento. O modo Claude reduz bastante esses erros.
- **Seletores do Instagram mudam.** O Instagram ofusca e troca o DOM com frequência. Se a coleta parar de funcionar, os seletores em `src/content.js` precisam de ajuste.
- **Reel de vídeo sem slides** não tem o que transcrever — a extensão avisa.
- Funciona em `instagram.com` no desktop, logado.

## FAQ

**Meus dados ficam seguros?**
No modo Tesseract (padrão), sim — tudo no seu navegador, nada sai da máquina. No modo Claude (que você liga de propósito), cada slide vai pra API da Anthropic com a sua chave. Detalhes em [PRIVACY.md](./PRIVACY.md).

**Preciso pagar?**
O modo padrão é grátis e ilimitado. O modo Claude usa a sua chave da Anthropic e custa centavos por carrossel (tabela acima).

**Como desinstalo?**
`chrome://extensions` → Remover. Some tudo, inclusive a chave salva.

**Funciona no Edge/Brave/Arc?**
Sim — qualquer navegador baseado em Chromium, no desktop.

## Estrutura

```text
instagram-carousel-transcriber/
├── manifest.json        # Manifest V3
├── src/
│   ├── content.js       # detecta o carrossel, percorre os slides, coleta imagens + legenda
│   ├── popup.html/js    # UI, orquestra o OCR, monta o .md, dispara o download
│   ├── ocr.js           # wrapper do Tesseract.js (worker/core/lang via getURL)
│   ├── claude.js        # modo Claude opcional (visão do Claude via chave do usuário)
│   ├── options.html/js  # liga o modo Claude e guarda a chave
│   ├── markdown.js      # monta o arquivo .md
│   └── styles.css
├── vendor/              # Tesseract.js bundlado (FETCH.sh baixa os binários)
└── icons/
```

## Licença

[MIT](../../LICENSE). Por [Marcel Serrano](https://github.com/1marcelserrano) / MSCREATIVE.SYSTEMS™.

---

## English

**Read every slide of an Instagram carousel and download a single `.md`. Local OCR by default; optional Claude mode for high quality.**

A Chrome extension (Manifest V3), open-source (MIT). Open a carousel, click a button, get a Markdown file with the text of each slide plus the original caption.

### How it works

1. Open an Instagram post (`/p/...`) or reel (`/reel/...`) while logged in.
2. Click the extension icon → "Transcrever carrossel".
3. The extension walks the slides, reads each one, and downloads a `.md`.

By default OCR runs 100% locally with [Tesseract.js](https://tesseract.projectnaptha.com/) — no image leaves your machine, no paid API, no backend. Want high quality on stylized slides? Turn on [Claude mode](#claude-mode-optional).

### Install (developer mode)

Not on the Chrome Web Store yet. Install via "Load unpacked":

1. Download or clone this folder (`instagram-carousel-transcriber/`).
2. If `vendor/` ships without the Tesseract binaries, run inside it:
   ```bash
   cd vendor && bash FETCH.sh
   ```
   This fetches the OCR engine (≈9 MB) that must be bundled — Manifest V3's CSP forbids loading from a CDN at runtime.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top right).
5. Click **Load unpacked** and pick the `instagram-carousel-transcriber/` folder.
6. Pin it. If something hangs, reload the extension (↻) and retry — Chrome won't pick up file edits without a reload.

### Use

Open a carousel, click the icon, hit **Transcrever carrossel**, watch the progress bar. The file `carrossel_<shortcode>.md` downloads on its own. The `Motor` field in the header tells you which engine ran — `Tesseract` or `Claude`.

### Claude mode (optional)

Tesseract is free and local but struggles with stylized text over photos. Claude mode uses [Claude](https://www.anthropic.com/claude) vision to read those slides far better, with **your own** Anthropic key.

1. Get a key at [console.anthropic.com](https://console.anthropic.com) (`sk-ant-...`).
2. In `chrome://extensions`, open the extension's **Details** → **Extension options** (or right-click the icon → **Options**).
3. Check **Modo Claude**, paste the key, pick a model, click **Salvar**.

Cost is a few cents per carousel (~US$0.03 on Haiku 4.5, ~US$0.15 on Opus 4.8). The key stays on your machine (`chrome.storage.local`) and is only sent to Anthropic's API at transcription time. Turn it off and everything runs local again.

### Limitations

- OCR is imperfect: stylized fonts and low-contrast text may produce errors in Tesseract mode. The **original caption is always included** as a fallback. Claude mode reduces these errors a lot.
- Instagram's DOM changes often; if collection breaks, the selectors in `src/content.js` need updating.
- A video reel with no slides has nothing to transcribe.

### Privacy

Tesseract mode: everything local, no server, no analytics, no external API. Claude mode: each slide goes to Anthropic's API with your key. See [PRIVACY.md](./PRIVACY.md).

### License

[MIT](../../LICENSE). By [Marcel Serrano](https://github.com/1marcelserrano) / MSCREATIVE.SYSTEMS™.
