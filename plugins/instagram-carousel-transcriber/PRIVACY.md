# Política de Privacidade

**Transcritor de Carrossel do Instagram**

Esta extensão não coleta, armazena nem transmite nenhum dado pessoal.

## O que a extensão faz

- Roda só quando você clica no botão "Transcrever carrossel", numa aba do Instagram que você mesmo abriu e onde já está logado.
- Lê as imagens do carrossel direto do DOM da página.
- Roda o OCR (reconhecimento de texto) **dentro do seu navegador**, via Tesseract.js bundlado na própria extensão.
- Gera um arquivo `.md` e baixa pra sua máquina.

## O que a extensão NÃO faz

- Não envia imagens, texto ou metadados pra nenhum servidor.
- Não usa nenhuma API externa em tempo de execução. Nada é carregado de CDN — todo o motor de OCR está embarcado na extensão.
- Não acessa suas credenciais do Instagram nem faz login por você.
- Não rastreia navegação, não usa analytics, não grava histórico.
- Não tem servidor. Não há backend.

## Permissões

| Permissão | Por quê |
|---|---|
| `activeTab` | Ler o post na aba que está aberta quando você aciona a extensão. |
| `downloads` | Salvar o arquivo `.md` gerado. |
| `host_permissions` (instagram.com, cdninstagram.com, fbcdn.net) | Baixar as imagens do carrossel pro OCR rodar localmente. |

Tudo acontece na sua máquina. Quando você fecha o navegador, não sobra nada.

---

Dúvidas: abra uma issue no repositório.
