import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalLibraryService } from '../services/LocalLibraryService.js';

const file = (type, extra = {}) => ({ kind: 'file', async getFile() { return { type, size: 12, lastModified: 7, ...extra }; } });
const vanishedFile = () => ({ kind: 'file', async getFile() { throw new DOMException('gone', 'NotFoundError'); } });
const directory = entries => ({ kind: 'directory', async *values() { for (const [name, value] of Object.entries(entries)) yield { name, ...value }; } });
const fakeDirectory = directory;
const memoryStore = () => {
  const values = new Map();
  return { get: vi.fn(key => values.get(key)), set: vi.fn((key, value) => values.set(key, value)), delete: vi.fn(key => values.delete(key)) };
};

describe('LocalLibraryService', () => {
  let store;
  let service;

  beforeEach(() => { store = memoryStore(); service = new LocalLibraryService({ idb: store, createId: () => 'library-id' }); });

  it('scans accepted files recursively and attaches captions from the same directory', async () => {
    const result = await service.scan(fakeDirectory({
      UNIFATECIE: directory({ Modulo: directory({
        Videos: directory({ 'Aula 01.mp4': file('video/mp4'), 'Aula 01.vtt': file('text/vtt') }),
        PDFs: directory({ 'Aula 01.pdf': file('application/pdf') }),
        desktop: file('text/plain'), 'desktop.ini': file('text/plain')
      }) })
    }));

    expect(result.items.map(({ title, resourceType }) => [title, resourceType]))
      .toEqual([['Aula 01', 'video'], ['Aula 01', 'pdf']]);
    expect(result.items[0].transcript.kind).toBe('captions');
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ name: 'desktop.ini', code: 'ignored-system-file' }));
  });

  it('attaches text and SRT sidecars only to same-name media in the same directory', async () => {
    const result = await service.scan(fakeDirectory({ Area: directory({
      'Aula.mp3': file('audio/mpeg'), 'Aula.txt': file('text/plain'),
      'Outra.mp3': file('audio/mpeg'), 'Outra.srt': file('text/plain')
    }) }));
    expect(result.items.find(item => item.title === 'Aula').transcript).toMatchObject({ kind: 'text', name: 'Aula.txt' });
    expect(result.items.find(item => item.title === 'Outra').transcript).toMatchObject({ kind: 'captions', name: 'Outra.srt' });
  });

  it('does not catalog unsupported files and reports them', async () => {
    const result = await service.scan(fakeDirectory({ Area: directory({ 'Livro.epub': file('application/epub+zip') }) }));
    expect(result.items).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ name: 'Livro.epub', code: 'unsupported-extension' }));
  });

  it('returns an honest empty catalog for an empty directory', async () => {
    await expect(service.scan(fakeDirectory({}))).resolves.toMatchObject({ items: [], diagnostics: [] });
  });

  it('does not scan a directory with denied permission', async () => {
    const denied = { ...fakeDirectory({}), async queryPermission() { return 'denied'; } };
    await expect(service.scan(denied)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('records a missing file and continues the scan', async () => {
    const result = await service.scan(fakeDirectory({ Area: directory({ 'sumiu.mp3': vanishedFile(), 'Aula.pdf': file('application/pdf') }) }));
    expect(result.items).toHaveLength(1);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ name: 'sumiu.mp3', code: 'file-unavailable' }));
  });

  it('does not attach a sidecar from a parent directory', async () => {
    const result = await service.scan(fakeDirectory({ Area: directory({
      Videos: directory({ 'Aula.mp4': file('video/mp4') }), 'Aula.vtt': file('text/vtt')
    }) }));
    expect(result.items[0].transcript).toBeUndefined();
  });

  it('catalogs only a valid exact local exam filename', async () => {
    const exam = JSON.stringify({
      schema: 'bsestudos.exam.v1', id: 'enem-2026', title: 'ENEM 2026', durationMinutes: 330,
      questions: [{ id: 'q1', statement: 'Questao', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 0 }]
    });
    const result = await service.scan(fakeDirectory({ Area: directory({
      'enem.bsestudos.exam.json': file('application/json', { text: async () => exam }),
      'almost.bsestudos.exam.json.bak': file('application/json', { text: async () => exam })
    }) }));
    expect(result.items.map(item => [item.title, item.resourceType])).toEqual([['enem', 'exam']]);
  });

  it('clears the in-memory catalog when permission is denied after indexing', async () => {
    const handle = { ...fakeDirectory({ Area: directory({ 'Aula.pdf': file('application/pdf') }) }), async queryPermission() { return 'granted'; } };
    await service.refresh(handle);
    const itemId = service.items[0].id;
    handle.queryPermission = async () => 'denied';
    await expect(service.refresh(handle)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(service.search('aula')).toEqual([]);
    expect(service.getItem(itemId)).toBeNull();
  });

  it('reports a file removed after indexing when creating its object URL', async () => {
    let exists = true;
    const handle = { kind: 'file', async getFile() { if (!exists) throw new DOMException('gone', 'NotFoundError'); return { type: 'audio/mpeg', size: 12, lastModified: 7 }; } };
    const result = await service.refresh(fakeDirectory({ Area: directory({ 'Aula.mp3': handle }) }));
    exists = false;
    await expect(service.createObjectUrl(result.items[0])).rejects.toMatchObject({ code: 'file-unavailable' });
  });

  it('searches titles without case distinction', async () => {
    await service.refresh(fakeDirectory({ Area: directory({ 'FÍSICA Aula.pdf': file('application/pdf') }) }));
    expect(service.search('física')).toHaveLength(1);
    expect(service.search('AULA')).toHaveLength(1);
  });

  it('uses the read-only picker contract and persists only local catalog state', async () => {
    const handle = fakeDirectory({});
    const picker = vi.fn().mockResolvedValue(handle);
    const previousWindow = globalThis.window;
    globalThis.window = { showDirectoryPicker: picker };
    await service.connect();
    globalThis.window = previousWindow;
    expect(picker).toHaveBeenCalledWith({ mode: 'read', id: 'bs-estudos-library' });
    expect(store.set).toHaveBeenCalledWith('local-library-handle', handle);
    expect(store.set).toHaveBeenCalledWith('local-library-id', 'library-id');
  });
});
