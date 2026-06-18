// Monta o .md único a partir do resultado do OCR + metadados do post.

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildMarkdown({ author, url, caption }, slides, engine) {
  const lines = [];
  lines.push(`# Transcrição — Carrossel @${author || "desconhecido"}`);
  lines.push(
    `> Fonte: ${url} · Slides: ${slides.length} · Motor: ${engine || "Tesseract"} · Gerado: ${todayISO()}`
  );
  lines.push("");

  slides.forEach((text, i) => {
    lines.push(`## Slide ${i + 1}`);
    lines.push(text && text.length ? text : "_(sem texto detectado)_");
    lines.push("");
  });

  lines.push("---");
  lines.push("## Legenda original");
  lines.push(caption && caption.length ? caption : "_(sem legenda)_");
  lines.push("");

  return lines.join("\n");
}

function filenameFor(shortcode) {
  return `carrossel_${shortcode || "instagram"}.md`;
}
