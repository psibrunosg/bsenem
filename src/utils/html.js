export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function highlightText(value, query) {
  const text = String(value ?? '');
  const search = String(query ?? '');
  if (!search) return escapeHtml(text);

  const escapedPattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(${escapedPattern})`, 'gi');
  return text.split(matcher).map((part, index) => (
    index % 2 === 1
      ? `<mark style="background: var(--warning-bg); color: var(--warning); padding: 0 2px; border-radius: 2px;">${escapeHtml(part)}</mark>`
      : escapeHtml(part)
  )).join('');
}

export function safeResourceUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  if (/^(?:https?:|blob:)/i.test(url)) return escapeHtml(url);
  if (/^(?:javascript|data|vbscript):/i.test(url)) return '#';
  return escapeHtml(url);
}

export function safeCssColor(value) {
  const color = String(value ?? '').trim();
  return /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(color)
    ? color
    : 'inherit';
}
