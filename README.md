# mscreative-plugins

**Plugins públicos da MSCREATIVE.SYSTEMS™. Ferramentas de navegador, open-source, em português.**

[Instalar](#instalar) • [Plugins](#plugins-disponíveis) • [Os plugins em detalhe](#os-plugins-em-detalhe)

---

Uma coleção de plugins de navegador — testados em uso real, escritos em PT-BR, sem firula. Cada um roda local, sem servidor. Instale o que precisar.

## Plugins disponíveis

| Plugin | Versão | O que faz | Tipo |
|---|---|---|---|
| [`instagram-carousel-transcriber`](./plugins/instagram-carousel-transcriber/) | v0.1.0 | Lê todos os slides de um carrossel do Instagram via OCR local e baixa um único `.md` com o texto de cada slide + a legenda. Nada sai do navegador. | Extensão Chrome (MV3) |

## Instalar

Cada plugin tem o próprio README com o passo a passo. O caminho comum, pra extensões Chrome em modo desenvolvedor:

1. Baixe ou clone este repo.
2. Entre na pasta do plugin (ex.: `plugins/instagram-carousel-transcriber/`) e siga o README dele — alguns precisam de um passo de `FETCH.sh` pra baixar binários que ficam embarcados.
3. Abra `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e aponte pra pasta do plugin.

```bash
git clone https://github.com/1marcelserrano/mscreative-plugins.git
# depois: chrome://extensions → Carregar sem compactação → plugins/<nome>/
```

## Os plugins em detalhe

### `instagram-carousel-transcriber`

Extensão Chrome (Manifest V3, MIT) que percorre um carrossel do Instagram aberto na sua aba logada, lê o texto de cada slide com OCR ([Tesseract.js](https://tesseract.projectnaptha.com/), `por+eng`) **dentro do navegador**, e baixa um único `.md` com slide a slide + a legenda original.

- OCR 100% local. Nenhuma imagem ou texto sai da máquina. Sem API paga, sem backend.
- Pasta auto-contida, pronta pra listagem na Chrome Web Store.
- README, instalação, limitações e privacidade: [`plugins/instagram-carousel-transcriber/`](./plugins/instagram-carousel-transcriber/).

---

## Licença

[MIT](./LICENSE). Por [Marcel Serrano](https://github.com/1marcelserrano) / MSCREATIVE.SYSTEMS™.
