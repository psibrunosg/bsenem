import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPage } from '../pages/AudioPage.js';
import { VideoPage } from '../pages/VideoPage.js';
import { LibraryPage } from '../pages/LibraryPage.js';

const handle = (file) => ({ getFile: vi.fn().mockResolvedValue(file) });
const localItem = (resourceType, overrides = {}) => ({
  id: `${resourceType}-1`, title: 'Sistema nervoso', resourceType, extension: resourceType === 'video' ? 'mp4' : resourceType === 'audio' ? 'mp3' : 'pdf',
  handle: handle(new File(['conteúdo'], `aula.${resourceType === 'video' ? 'mp4' : resourceType === 'audio' ? 'mp3' : 'pdf'}`)), ...overrides
});

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {}, scale() {} });
});

describe('local media pages', () => {
  it('uses the pending local video resource without a playlist or external URL', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() });
    const page = new VideoPage({ app: { consumeLocalResource: vi.fn(() => localItem('video')) } });
    const element = await page.render();

    expect(element.querySelector('video').src).toContain('blob:video');
    expect(element.querySelector('.video-playlist-container')).toBeNull();
    expect(element.innerHTML).not.toMatch(/https?:/);
  });

  it('shows a searchable transcript for a local audio TXT sidecar', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:audio'), revokeObjectURL: vi.fn() });
    const audio = localItem('audio', { transcript: { kind: 'text', name: 'aula.txt' }, sidecarHandle: handle({ name: 'aula.txt', text: async () => 'Sistema nervoso central' }) });
    const page = new AudioPage({ app: { consumeLocalResource: vi.fn(() => audio) } });
    const element = await page.render();

    expect(element.querySelector('audio').src).toContain('blob:audio');
    expect(element.querySelector('.transcript-panel').textContent).toContain('Sistema nervoso central');
    expect(element.innerHTML).not.toMatch(/https?:/);
  });

  it('opens a local PDF in the viewer from the resource bridge', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });
    const page = new LibraryPage({ app: { consumeLocalResource: vi.fn(() => localItem('pdf')) }, library: { items: [] } });
    const element = await page.render();

    expect(element.querySelector('.pdf-viewer')).not.toBeNull();
  });
});
