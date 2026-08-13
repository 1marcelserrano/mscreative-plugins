# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · Versionamento [SemVer](https://semver.org/lang/pt-BR/).

Cada plugin versiona no próprio `manifest.json`. As entradas abaixo são por plugin.

## full-page-capture

### [0.1.0] — 2026-08-13

#### Adicionado
- Primeira versão. Captura de página inteira por costura de rolagem: cada tela é fotografada de verdade, nada é reconstruído a partir do DOM.
- **Detecta o container que realmente rola** e confirma o alvo antes de capturar. Em Gmail, Notion e painéis administrativos, quem rola é um `div`, não a janela.
- **Elementos fixos e grudentos entram só no primeiro quadro.** Cabeçalho aparece uma vez; barra de cookies e widget de chat não se repetem ao longo da imagem.
- **Espera o conteúdo assentar a cada parada** — imagens decodificadas e DOM em silêncio, com teto de tempo.
- Costura posicionada pela rolagem efetiva, não pela pretendida: página com `scroll-snap` ou que trava no fim continua alinhada.
- Limite de 60 telas e limite de canvas do navegador com aviso explícito. Truncamento nunca é silencioso.
- Três funções puras (plano da costura, pontuação de candidatos, nome do arquivo) cobertas por `node --test`, sem nenhuma dependência.

## instagram-carousel-transcriber

### [0.2.0] — 2026-06-18

#### Adicionado
- **Modo Claude (opcional).** OCR via visão do Claude usando a chave do próprio usuário — lê texto estilizado e fotos muito melhor que o Tesseract. O padrão continua 100% local.
- Página de Opções: ligar o modo Claude, colar a chave Anthropic, escolher o modelo (Haiku 4.5 ou Opus 4.8).
- O cabeçalho do `.md` carimba o motor usado (`Tesseract` ou `Claude`), pra não restar dúvida de como o arquivo foi gerado.

#### Corrigido
- Worker do Tesseract não carregava (worker nascia de um blob e o `importScripts` do core virava cross-origin) — resolvido com `workerBlobURL: false`.
- WASM bloqueado pela CSP do Manifest V3 — `wasm-unsafe-eval` declarado no manifest.
- Autor e legenda agora saem das meta tags do post (`og:description`), que resistem melhor às mudanças do DOM do Instagram.
- Filtro de confiança no OCR corta o ruído que o Tesseract gerava em slides que são foto.

#### Mudado
- Ícone novo (slide com linhas de texto + dots de carrossel).

### [0.1.0] — 2026-06-17

#### Adicionado
- Primeira versão. Transcrição de carrossel do Instagram via OCR local (Tesseract.js, `por+eng`) e download de um `.md` único com slide a slide + legenda.
