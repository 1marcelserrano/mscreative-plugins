# Transcritor de Carrossel do Instagram

**Leia todos os slides de um carrossel do Instagram e baixe um único `.md`. OCR local, zero servidor, nada sai do navegador.**

Extensão Chrome (Manifest V3), open-source (MIT). Você abre um carrossel, clica num botão, e recebe um arquivo Markdown com o texto de cada slide mais a legenda original.

🇧🇷 Português abaixo · 🇺🇸 [English below](#english)

---

## Como funciona

1. Você abre um post (`/p/...`) ou reel (`/reel/...`) do Instagram, logado na sua conta.
2. Clica no ícone da extensão → "Transcrever carrossel".
3. A extensão percorre os slides, lê o texto de cada um com OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) **dentro do navegador**, e baixa um `.md`.

O OCR roda 100% local. Nenhuma imagem ou texto sai da sua máquina. Não há API paga, não há backend.

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
6. Fixe a extensão na barra. Pronto.

## Usar

1. Abra um carrossel do Instagram.
2. Clique no ícone da extensão.
3. Clique em **Transcrever carrossel** e acompanhe a barra de progresso.
4. O arquivo `carrossel_<shortcode>.md` baixa sozinho.

### Formato do arquivo

```markdown
# Transcrição — Carrossel @autor
> Fonte: <url> · Slides: N · Gerado: 2026-06-17

## Slide 1
<texto lido do slide>

## Slide 2
<texto lido do slide>

---
## Legenda original
<legenda do post>
```

## Limitações

- **OCR não é mágica.** Fontes muito estilizadas, texto sobre fundo de baixo contraste ou tipografia decorativa podem sair com erros. Por isso a **legenda original entra sempre** no arquivo, como complemento.
- **Seletores do Instagram mudam.** O Instagram ofusca e troca o DOM com frequência. Se a coleta parar de funcionar, os seletores em `src/content.js` precisam de ajuste.
- **Reel de vídeo sem slides** não tem o que transcrever — a extensão avisa.
- Funciona em `instagram.com` no desktop, logado.

## Privacidade

Tudo local. Nada de servidor, nada de analytics, nada de API externa. Detalhes em [PRIVACY.md](./PRIVACY.md).

## Estrutura

```text
instagram-carousel-transcriber/
├── manifest.json        # Manifest V3
├── src/
│   ├── content.js       # detecta o carrossel, percorre os slides, coleta imagens + legenda
│   ├── popup.html/js    # UI, orquestra o OCR, monta o .md, dispara o download
│   ├── ocr.js           # wrapper do Tesseract.js (worker/core/lang via getURL)
│   ├── markdown.js      # monta o arquivo .md
│   └── styles.css
├── vendor/              # Tesseract.js bundlado (FETCH.sh baixa os binários)
└── icons/
```

## Licença

[MIT](./LICENSE). Por [Marcel Serrano](https://github.com/1marcelserrano) / MSCREATIVE.SYSTEMS™.

---

## English

**Read every slide of an Instagram carousel and download a single `.md`. Local OCR, no server, nothing leaves your browser.**

A Chrome extension (Manifest V3), open-source (MIT). Open a carousel, click a button, get a Markdown file with the text of each slide plus the original caption.

### How it works

1. Open an Instagram post (`/p/...`) or reel (`/reel/...`) while logged in.
2. Click the extension icon → "Transcrever carrossel".
3. The extension walks the slides, reads each one with OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) **inside the browser**, and downloads a `.md`.

OCR runs 100% locally. No image or text leaves your machine. No paid API, no backend.

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
6. Pin it. Done.

### Use

Open a carousel, click the icon, hit **Transcrever carrossel**, watch the progress bar. The file `carrossel_<shortcode>.md` downloads on its own.

### Limitations

- OCR is imperfect: stylized fonts and low-contrast text may produce errors. The **original caption is always included** as a fallback.
- Instagram's DOM changes often; if collection breaks, the selectors in `src/content.js` need updating.
- A video reel with no slides has nothing to transcribe.

### Privacy

Everything local. No server, no analytics, no external API. See [PRIVACY.md](./PRIVACY.md).

### License

[MIT](./LICENSE). By [Marcel Serrano](https://github.com/1marcelserrano) / MSCREATIVE.SYSTEMS™.
