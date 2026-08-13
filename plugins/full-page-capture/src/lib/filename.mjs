const MAX_SLUG = 60;

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoLocalDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hostSlug(url) {
  try {
    return slugify(new URL(url).hostname.replace(/^www\./, '')) || 'pagina';
  } catch {
    return 'pagina';
  }
}

export function buildFilename({ url, title, date }) {
  const day = isoLocalDate(date);
  const host = hostSlug(url);
  const full = slugify(title);
  const cut = full.slice(0, MAX_SLUG).replace(/-+$/, '');
  return `${day}_${host}_${cut || 'sem-titulo'}.png`;
}
