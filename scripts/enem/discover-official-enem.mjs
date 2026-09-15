import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateInventory } from './archiveContract.mjs';

export const OFFICIAL_INDEX_URL = 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos';

export function extractOfficialEntries(html, sourcePageUrl, discoveredAt = new Date().toISOString(), defaultYear = null) {
  html = annualContent(html);
  const entries = [];
  const unclassifiedLinks = [];
  const excludedLinks = [];
  const urls = new Set();
  let year = defaultYear;
  const token = /<h[1-6][^>]*>\s*(20(?:0[9]|1\d|2[0-5]))\s*<\/h[1-6]>|<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(token)) {
    if (match[1]) {
      year = Number(match[1]);
      continue;
    }
    if (!year) continue;
    const officialUrl = decodeHtml(match[2]).trim();
    const label = stripHtml(match[3]);
    const sourceLabel = nearestLabel(html, match.index);
    if (!isOfficialDocumentUrl(officialUrl)) continue;
    const documentKind = documentKindFor(label, officialUrl);
    if (!documentKind) {
      const reason = /tema\s+da\s+redaç[aã]o/i.test(label) ? 'outside-caderno-gabarito-scope' : null;
      (reason ? excludedLinks : unclassifiedLinks).push({ year, label, officialUrl, ...(reason ? { reason } : {}) });
      continue;
    }
    if (!new URL(officialUrl).pathname.toLocaleLowerCase().endsWith('.pdf')) {
      excludedLinks.push({ year, label, officialUrl, reason: 'unsupported-format' });
      continue;
    }
    if (urls.has(officialUrl)) continue;
    urls.add(officialUrl);
    entries.push({
      year,
      application: applicationFor(`${sourceLabel || ''} ${label}`),
      documentKind,
      officialUrl,
      sourcePageUrl,
      discoveredAt,
      sourceLabel,
      day: dayFor(sourceLabel)
    });
  }
  return { sourcePageUrl, retrievedAt: discoveredAt, entries, unclassifiedLinks, excludedLinks };
}

function annualContent(html) {
  const match = html.match(/<div\s+id=["']parent-fieldname-text["'][^>]*>/i);
  return match ? html.slice(match.index + match[0].length) : html;
}

function isOfficialDocumentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'download.inep.gov.br';
  } catch {
    return false;
  }
}

export async function discoverOfficialInventory({
  sourcePageUrl = OFFICIAL_INDEX_URL,
  years = archiveYears(),
  fetchImpl = fetch,
  discoveredAt = new Date().toISOString()
} = {}) {
  const indexHtml = await fetchText(fetchImpl, sourcePageUrl);
  const tabs = extractYearTabs(indexHtml);
  const entries = [];
  const unclassifiedLinks = [];
  const excludedLinks = [];
  const seenUrls = new Set();
  const yearSources = [];

  for (const year of years) {
    const tabUrl = tabs.get(year);
    if (!tabUrl) throw new Error(`official index has no tab for ${year}`);
    const result = extractOfficialEntries(await fetchText(fetchImpl, tabUrl), tabUrl, discoveredAt, year);
    yearSources.push({ year, sourcePageUrl: tabUrl });
    for (const entry of result.entries) {
      if (seenUrls.has(entry.officialUrl)) continue;
      seenUrls.add(entry.officialUrl);
      entries.push(entry);
    }
    unclassifiedLinks.push(...result.unclassifiedLinks);
    excludedLinks.push(...result.excludedLinks);
  }

  return { sourcePageUrl, retrievedAt: discoveredAt, yearSources, entries, unclassifiedLinks, excludedLinks };
}

function documentKindFor(label) {
  const source = label.toLocaleLowerCase();
  if (/(gabarito|resposta)/.test(source)) return 'gabarito';
  if (/(prova|caderno)/.test(source)) return 'prova';
  return null;
}

function applicationFor(label) {
  const source = label.toLocaleLowerCase();
  if (source.includes('digital')) return 'digital';
  if (/\bppl\b|pessoas privadas de liberdade/.test(source)) return 'ppl';
  if (source.includes('reaplica')) return 'reaplicacao';
  return 'regular';
}

function nearestLabel(html, index) {
  const before = html.slice(0, index);
  const labels = [...before.matchAll(/<(?:p|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:p|h[1-6])>/gi)];
  return labels.length ? stripHtml(labels.at(-1)[1]) : null;
}

function dayFor(label) {
  const match = String(label || '').match(/\b(?:([12])º?\s*dia|dia\s*([12]))\b/i);
  return match ? Number(match[1] || match[2]) : null;
}

function stripHtml(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeHtml(value) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}

function extractYearTabs(html) {
  const tabs = new Map();
  for (const match of html.matchAll(/<[^>]+>/g)) {
    const tag = match[0];
    const year = attribute(tag, 'data-id');
    const url = attribute(tag, 'data-url');
    if (!/^20(?:0[9]|1\d|2[0-5])$/.test(year || '') || !url) continue;
    tabs.set(Number(year), decodeHtml(url));
  }
  return tabs;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] || null;
}

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`official source HTTP ${response.status}: ${url}`);
  return response.text();
}

function archiveYears() {
  return Array.from({ length: 17 }, (_value, index) => 2009 + index);
}

async function main() {
  const output = argumentValue('--output');
  if (!output) throw new Error('missing --output');
  const result = await discoverOfficialInventory();
  const validation = validateInventory(result.entries);
  await writeFile(output, `${JSON.stringify({ ...result, validation }, null, 2)}\n`, 'utf8');
  const years = new Set(result.entries.map(entry => entry.year));
  if (result.unclassifiedLinks.length || !validation.valid || years.size !== 17) {
    throw new Error(`inventory requires review: entries=${result.entries.length} unclassified=${result.unclassifiedLinks.length} years=${years.size}`);
  }
  console.log(JSON.stringify({ entries: result.entries.length, years: [...years].sort((a, b) => a - b) }));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] || null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
