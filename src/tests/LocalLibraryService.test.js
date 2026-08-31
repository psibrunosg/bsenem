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
        Videos: directory({ 'Aula 01.mp4': file('video/mp4') }),
        PDFs: directory({ 'Aula 01.pdf': file('application/pdf') }),
        'Aula 01.vtt': file('text/vtt'), desktop: file('text/plain'), 'desktop.ini': file('text/plain')
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
