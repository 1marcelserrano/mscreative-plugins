# Política de Privacidade

**Transcritor de Carrossel do Instagram**

A extensão tem dois modos. O padrão é 100% local. O modo Claude, que você liga de propósito, envia as imagens dos slides pra API da Anthropic. Esta política descreve os dois.

## O que a extensão faz (sempre)

- Roda só quando você clica em "Transcrever carrossel", numa aba do Instagram que você mesmo abriu e onde já está logado.
- Lê as imagens do carrossel direto do DOM da página.
- Gera um arquivo `.md` e baixa pra sua máquina.
- Não acessa suas credenciais do Instagram nem faz login por você.
- Não rastreia navegação, não usa analytics, não grava histórico.
- Não tem servidor próprio. Não há backend nosso.

## Modo Tesseract (padrão)

- O OCR roda **dentro do seu navegador**, via Tesseract.js bundlado na própria extensão.
- Nenhuma imagem, texto ou metadado sai da sua máquina.
- Nada é carregado de CDN em tempo de execução — todo o motor de OCR está embarcado.
- Quando você fecha o navegador, não sobra nada.

## Modo Claude (opcional, desligado por padrão)

Você liga este modo nas Opções e cola a sua própria chave da Anthropic. Com ele ativo:

- Cada imagem de slide é enviada pra **API da Anthropic** (`api.anthropic.com`) pra leitura, autenticada com a sua chave.
- O uso passa a ser regido pelos [termos](https://www.anthropic.com/legal/commercial-terms) e pela [política de privacidade](https://www.anthropic.com/legal/privacy) da Anthropic.
- A sua chave fica salva **só na sua máquina** (`chrome.storage.local`). Não é enviada pra nenhum lugar além da própria API da Anthropic, e some quando você remove a extensão.
- Desligou o modo Claude? A extensão volta a rodar 100% local (Tesseract).

## Permissões

| Permissão | Por quê |
|---|---|
| `activeTab` | Ler o post na aba aberta quando você aciona a extensão. |
| `downloads` | Salvar o arquivo `.md` gerado. |
| `storage` | Guardar a sua chave e a preferência de modo, localmente. |
| `host_permissions` (instagram.com, cdninstagram.com, fbcdn.net) | Baixar as imagens do carrossel pro OCR rodar. |
| `host_permissions` (api.anthropic.com) | Só usada no modo Claude, pra enviar os slides pra leitura. |

---

Dúvidas: abra uma issue no repositório.
