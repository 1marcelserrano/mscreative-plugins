// Modo Claude (opcional): transcreve cada slide via Claude vision em vez do Tesseract.
// Chamada direta do navegador com a chave do próprio usuário — nada de backend.
// O header anthropic-dangerous-direct-browser-access libera a chamada client-side.

const CLAUDE_PROMPT =
  "Transcreva todo o texto visível neste slide de carrossel, na ordem de leitura, " +
  "preservando as quebras de linha. Devolva só o texto — sem comentários, sem descrever " +
  "a imagem. Se não houver texto legível, devolva uma string vazia.";

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

async function claudeImage(url, settings, onProgress) {
  if (onProgress) onProgress(0.1);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${resp.status} em ${url}`);
  const blob = await resp.blob();
  const data = await blobToBase64(blob);
  const mediaType = /jpe?g|png|gif|webp/.test(blob.type) ? blob.type : "image/jpeg";
  if (onProgress) onProgress(0.4);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.model || "claude-haiku-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: CLAUDE_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!r.ok) {
    let detail = "";
    try {
      const j = await r.json();
      detail = (j.error && j.error.message) || "";
    } catch {
      detail = await r.text().catch(() => "");
    }
    if (r.status === 401) throw new Error("Chave Anthropic inválida (401). Confira nas opções.");
    throw new Error(`Claude ${r.status}: ${detail.slice(0, 200)}`);
  }

  const j = await r.json();
  if (onProgress) onProgress(1);
  return (j.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
