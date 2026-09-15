const FIRST_YEAR = 2009;
const LAST_YEAR = 2025;
const DOCUMENT_KINDS = new Set(['prova', 'gabarito']);

export function validateInventoryEntry(entry) {
  const errors = [];
  if (!Number.isInteger(entry?.year) || entry.year < FIRST_YEAR || entry.year > LAST_YEAR) errors.push('year');
  if (!nonEmpty(entry?.application)) errors.push('application');
  if (!DOCUMENT_KINDS.has(entry?.documentKind)) errors.push('documentKind');
  if (!isOfficialInepUrl(entry?.officialUrl)) errors.push('officialUrl');
  if (!isOfficialSourcePageUrl(entry?.sourcePageUrl)) errors.push('sourcePageUrl');
  if (!isTimestamp(entry?.discoveredAt)) errors.push('discoveredAt');
  return { valid: errors.length === 0, errors };
}

export function validateInventory(entries) {
  const errors = [];
  const urls = new Set();
  for (const [index, entry] of entries.entries()) {
    const result = validateInventoryEntry(entry);
    errors.push(...result.errors.map(error => `entries[${index}].${error}`));
    if (urls.has(entry?.officialUrl)) errors.push(`entries[${index}].officialUrl`);
    urls.add(entry?.officialUrl);
  }
  return { valid: errors.length === 0, errors };
}

export function isOfficialInepUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'inep.gov.br' || url.hostname.endsWith('.inep.gov.br'));
  } catch {
    return false;
  }
}

function isOfficialSourcePageUrl(value) {
  try {
    const url = new URL(value);
    return isOfficialInepUrl(value)
      || (url.protocol === 'https:' && url.hostname === 'www.gov.br' && url.pathname.startsWith('/inep/'));
  } catch {
    return false;
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value) {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}
