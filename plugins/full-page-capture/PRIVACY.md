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
