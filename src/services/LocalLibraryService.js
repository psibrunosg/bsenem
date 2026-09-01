import { idb as browserIdb } from '../utils/idb.js';
import { validateLocalExam } from './examSchema.js';
import { buildCourseCatalog, isTypeFolder } from './courseCatalog.js';

const MEDIA_TYPES = new Map([
  ['mp4', 'video'], ['webm', 'video'], ['ogv', 'video'],
  ['mp3', 'audio'], ['m4a', 'audio'], ['wav', 'audio'], ['ogg', 'audio'], ['opus', 'audio'],
  ['pdf', 'pdf']
]);
const SIDECAR_TYPES = new Set(['vtt', 'srt', 'txt']);
export class LocalLibraryService {
  constructor({ idb = browserIdb, createId = defaultId } = {}) {
    this.idb = idb;
    this.createId = createId;
    this.items = [];
    this.diagnostics = [];
    this.catalog = buildCourseCatalog([]);
    this.fileHandles = new Map();
    this.objectUrls = new Map();
  }

  async connect() {
    const handle = await window.showDirectoryPicker({ mode: 'read', id: 'bs-estudos-library' });
    await this.idb.set('local-library-handle', handle);
    return this.refresh(handle);
  }

  async restore() {
    const handle = await this.idb.get('local-library-handle');
    if (!handle) return { items: [], diagnostics: [], catalog: this.catalog };
    if (await permission(handle) !== 'granted') {
      this.clearCatalog();
      throw localError('permission-denied');
    }
    return this.refresh(handle);
  }

  async refresh(handle) {
    handle ||= await this.idb.get('local-library-handle');
    if (!handle) return { items: [], diagnostics: [], catalog: this.catalog };
    const result = await this.scan(handle);
    this.items = result.items;
    this.diagnostics = result.diagnostics;
    this.catalog = buildCourseCatalog(result.items);
    await this.idb.set('local-library-handle', handle);
    await this.idb.set('local-library-id', await this.libraryId());
    await this.idb.set('local-library-items', result.items);
    await this.idb.set('local-library-diagnostics', result.diagnostics);
    return { ...result, catalog: this.catalog };
  }

  async scan(handle) {
    if (await permission(handle) === 'denied') {
      this.clearCatalog();
      throw localError('permission-denied');
    }
    const files = [];
    const diagnostics = [];
    this.fileHandles.clear();
    await visit(handle, [], files, diagnostics);
    const sidecars = new Map();
    for (const entry of files.filter(entry => SIDECAR_TYPES.has(entry.extension))) {
      entry.id = this.createId();
      sidecars.set(sidecarKey(entry.path, entry.basename), entry);
    }
    const items = [];
    for (const entry of files) {
      if (isExam(entry.name)) {
        const exam = await localExam(entry, diagnostics);
        if (!exam) continue;
        const id = this.createId();
        items.push(Object.freeze({
          id, relativePath: [...entry.path, entry.name].join('/'), title: entry.name.slice(0, -'.bsestudos.exam.json'.length),
          area: entry.path[0] || '', collection: collection(entry.path), resourceType: 'exam', extension: 'bsestudos.exam.json',
          size: entry.file.size, modifiedAt: entry.file.lastModified, transcriptId: null,
          pathSegments: Object.freeze([...entry.path]), rawTitle: entry.name.slice(0, -'.bsestudos.exam.json'.length), typeFolder: typeFolder(entry.path)
        }));
        this.fileHandles.set(id, entry.handle);
        continue;
      }
      const resourceType = MEDIA_TYPES.get(entry.extension);
      if (!resourceType) {
        if (!SIDECAR_TYPES.has(entry.extension)) diagnostics.push({ name: entry.name, code: 'unsupported-extension' });
        continue;
      }
      const id = this.createId();
      const transcript = resourceType === 'pdf' ? null : transcriptFor(entry, sidecars);
      const item = {
        id, relativePath: [...entry.path, entry.name].join('/'), title: entry.basename,
        area: entry.path[0] || '', collection: collection(entry.path), resourceType, extension: entry.extension,
        size: entry.file.size, modifiedAt: entry.file.lastModified, transcriptId: transcript?.id ?? null,
        pathSegments: Object.freeze([...entry.path]), rawTitle: entry.basename, typeFolder: typeFolder(entry.path)
      };
      if (transcript) item.transcript = { id: transcript.id, name: transcript.name, kind: transcript.extension === 'txt' ? 'text' : 'captions' };
      items.push(Object.freeze(item));
      this.fileHandles.set(id, entry.handle);
    }
    return { items, diagnostics };
  }

  search(query) {
    const term = String(query || '').toLocaleLowerCase();
    return this.items.filter(item => `${item.title} ${item.area} ${item.collection}`.toLocaleLowerCase().includes(term));
  }

  getItem(id) { return this.items.find(item => item.id === id) || null; }

  async createObjectUrl(item) {
    const handle = this.fileHandles.get(item.id);
    if (!handle) throw localError('file-unavailable');
    try {
      const url = URL.createObjectURL(await handle.getFile());
      this.objectUrls.set(item.id, url);
      return url;
    } catch { throw localError('file-unavailable'); }
  }

  releaseObjectUrls() {
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
  }

  clearCatalog() {
    this.items = [];
    this.diagnostics = [];
    this.catalog = buildCourseCatalog([]);
    this.fileHandles.clear();
    this.releaseObjectUrls();
  }

  async reset() {
    this.clearCatalog();
    await Promise.all([
      'local-library-handle',
      'local-library-id',
      'local-library-items',
      'local-library-diagnostics'
    ].map((key) => this.idb.delete(key)));
  }

  async libraryId() {
    let id = await this.idb.get('local-library-id');
    if (!id) id = this.createId();
    return id;
  }
}

async function visit(directory, path, files, diagnostics) {
  for await (const handle of directory.values()) {
    const name = handle.name;
    if (hidden(name) || name.toLowerCase() === 'desktop.ini' || name.toLowerCase().endsWith('.lnk')) {
      diagnostics.push({ name, code: 'ignored-system-file' });
      continue;
    }
    if (handle.kind === 'directory') {
      if (name.toLowerCase() === 'cache') { diagnostics.push({ name, code: 'ignored-cache-directory' }); continue; }
      await visit(handle, [...path, name], files, diagnostics);
      continue;
    }
    const extension = ext(name);
    try {
      files.push({ handle, file: await handle.getFile(), name, path, extension, basename: base(name) });
    } catch { diagnostics.push({ name, code: 'file-unavailable' }); }
  }
}

function transcriptFor(entry, sidecars) {
  return sidecars.get(sidecarKey(entry.path, entry.basename)) || null;
}
function sidecarKey(path, basename) { return `${path.join('/')}\u0000${basename}`; }
function collection(path) { return path.slice(1).filter(part => !isTypeFolder(part)).join('/'); }
function typeFolder(path) { return path.find(isTypeFolder) || null; }
function ext(name) { const index = name.lastIndexOf('.'); return index < 0 ? '' : name.slice(index + 1).toLocaleLowerCase(); }
function base(name) { const index = name.lastIndexOf('.'); return index < 0 ? name : name.slice(0, index); }
function hidden(name) { return name.startsWith('.'); }
async function permission(handle) { return typeof handle.queryPermission === 'function' ? handle.queryPermission({ mode: 'read' }) : 'granted'; }
function isExam(name) { return name.endsWith('.bsestudos.exam.json'); }
async function localExam(entry, diagnostics) {
  try {
    const exam = JSON.parse(await entry.file.text());
    const result = validateLocalExam(exam);
    if (result.valid) return exam;
    diagnostics.push({ name: entry.name, code: 'invalid-exam', errors: result.errors });
  } catch { diagnostics.push({ name: entry.name, code: 'invalid-exam' }); }
  return null;
}
function localError(code) { return Object.assign(new Error(code), { code }); }
function defaultId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
