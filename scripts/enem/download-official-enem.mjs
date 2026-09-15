import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isOfficialInepUrl, validateInventoryEntry } from './archiveContract.mjs';

export async function downloadEntry(entry, root, fetchImpl = fetch, downloadedAt = new Date().toISOString()) {
  const validation = validateInventoryEntry(entry);
  const sourceUrl = downloadSourceUrl(entry);
  if (!validation.valid || !isOfficialInepUrl(entry.officialUrl) || !isAllowedDownloadSource(entry, sourceUrl)) throw new Error('unsafe download URL');
  const response = await fetchImpl(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !isPdfResponse(response.headers.get('content-type'), bytes)) throw new Error('invalid PDF response');

  const relativePath = archiveRelativePath(entry);
  const destination = join(root, relativePath);
  const sha256 = hash(bytes);
  await mkdir(dirname(destination), { recursive: true });
  const existing = await verifiedExisting(destination, sha256);
  if (existing === 'hash-conflict') throw new Error('hash-conflict');
  if (!existing) {
    const temporary = `${destination}.part`;
    await rm(temporary, { force: true });
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
  }
  return {
    ...entry,
    downloadedFromUrl: sourceUrl,
    relativePath: relativePath.replaceAll('\\', '/'),
    sha256,
    bytes: bytes.length,
    downloadedAt,
    httpStatus: response.status,
    contentType: response.headers.get('content-type') || null,
    status: existing ? 'already-verified' : 'downloaded'
  };
}

export async function downloadInventory(entries, root, fetchImpl = fetch, downloadedAt = new Date().toISOString()) {
  const records = [];
  for (const entry of entries) {
    try {
      records.push(await downloadEntry(entry, root, fetchImpl, downloadedAt));
    } catch (error) {
      records.push({ ...entry, status: 'failed', failureReason: error.message });
    }
  }
  return { schema: 'bsestudos.enem-archive-manifest.v1', generatedAt: downloadedAt, entries: records };
}

export function entriesForCanonicalSelection(selection, mirror = null) {
  if (!Array.isArray(selection?.selections) || selection.selections.length !== 34
    || selection.cadernoCount !== 34 || selection.gabaritoCount !== 34) {
    throw new Error('expected exactly 34 canonical selections');
  }
  if (mirror !== null && mirror !== 'projeto-medicina') throw new Error('unsupported mirror');
  const entries = selection.selections.flatMap(item => [
    withMirror(item.prova, item, mirror),
    withMirror(item.gabarito, item, mirror)
  ]);
  if (entries.length !== 68 || entries.some(entry => !entry)) throw new Error('invalid canonical selection entries');
  const urls = new Set(entries.map(entry => entry.officialUrl));
  if (urls.size !== 68) throw new Error('duplicate canonical selection document');
  return entries;
}

function withMirror(entry, selection, mirror) {
  if (mirror !== 'projeto-medicina') return entry;
  const name = entry.documentKind === 'prova' ? 'prova' : 'gabarito';
  const year = selection.year ?? entry.year;
  const day = selection.day ?? entry.day;
  return {
    ...entry,
    sourceType: 'nonofficial-mirror',
    mirrorProvider: 'Projeto Medicina',
    mirrorUrl: `https://cdn.projetomedicina.com.br/provas-enem/${year}/${name}-dia${day}.pdf`
  };
}

function archiveRelativePath(entry) {
  const url = new URL(downloadSourceUrl(entry));
  const rawName = basename(url.pathname);
  if (!rawName.toLocaleLowerCase().endsWith('.pdf')) throw new Error('unsafe official URL');
  const fileName = rawName.replace(/[^A-Za-z0-9._-]/g, '_');
  return join(String(entry.year), entry.application, entry.documentKind, fileName);
}

function downloadSourceUrl(entry) {
  return entry.mirrorUrl || entry.officialUrl;
}

function isAllowedDownloadSource(entry, value) {
  if (isOfficialInepUrl(value)) return true;
  if (entry.sourceType !== 'nonofficial-mirror' || entry.mirrorProvider !== 'Projeto Medicina') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'cdn.projetomedicina.com.br'
      && /^\/provas-enem\/(?:20(?:09|1[0-9]|2[0-5]))\/(?:prova|gabarito)-dia[12]\.pdf$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isPdfResponse(contentType, bytes) {
  return /^application\/pdf(?:;|$)/i.test(contentType || '') && bytes.subarray(0, 5).equals(Buffer.from('%PDF-'));
}

async function verifiedExisting(path, expectedHash) {
  try {
    await stat(path);
    return hash(await readFile(path)) === expectedHash ? 'already-verified' : 'hash-conflict';
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const selectionPath = argumentValue('--selection');
  const root = argumentValue('--root');
  const manifestPath = argumentValue('--manifest');
  if (!selectionPath || !root || !manifestPath) throw new Error('missing --selection, --root, or --manifest');
  const selection = JSON.parse(await readFile(selectionPath, 'utf8'));
  const entries = entriesForCanonicalSelection(selection, argumentValue('--mirror'));
  const manifest = await downloadInventory(entries, root);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const failed = manifest.entries.filter(entry => entry.status === 'failed');
  console.log(JSON.stringify({ expected: 68, downloaded: manifest.entries.filter(entry => entry.status === 'downloaded').length, alreadyVerified: manifest.entries.filter(entry => entry.status === 'already-verified').length, failed: failed.length }));
  if (failed.length) process.exitCode = 1;
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
