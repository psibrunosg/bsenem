import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalMediaSession } from '../services/localMediaSession.js';

const handle = (file) => ({ getFile: vi.fn().mockResolvedValue(file) });
const itemWithSrt = (text) => ({
  id: 'aula-1', extension: 'mp4', handle: handle(new File(['video'], 'aula.mp4', { type: 'video/mp4' })),
  transcript: { kind: 'captions', name: 'aula.srt' }, sidecarHandle: handle({ name: 'aula.srt', text: async () => text })
});

afterEach(() => vi.unstubAllGlobals());

describe('LocalMediaSession', () => {
  it('converts an SRT sidecar to an in-memory VTT caption URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:local');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });

    const session = await LocalMediaSession.open(itemWithSrt('1\n00:00:01,000 --> 00:00:02,000\nOlá'));

    expect(session.captions[0]).toMatchObject({ lang: 'pt', label: 'Português', default: true, src: 'blob:local' });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('keeps an existing VTT sidecar local without conversion', async () => {
    const createObjectURL = vi.fn(() => 'blob:local');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const item = itemWithSrt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOlá');
    item.transcript.name = 'aula.vtt';

    const session = await LocalMediaSession.open(item);

    expect(session.captions).toHaveLength(1);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('revokes every URL it created when closed', async () => {
    const createObjectURL = vi.fn(() => `blob:${createObjectURL.mock.calls.length}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const session = await LocalMediaSession.open(itemWithSrt('00:00:01,000 --> 00:00:02,000\nOlá'));

    session.close();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:2');
  });

  it('returns no transcript when no sidecar exists', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:local'), revokeObjectURL: vi.fn() });

    const session = await LocalMediaSession.open({ id: 'aula-1', handle: handle(new File(['video'], 'aula.mp4')) });

    expect(session.captions).toEqual([]);
    expect(session.transcriptText).toBe('');
  });

  it('reports a local unavailable file when its handle no longer yields a file', async () => {
    await expect(LocalMediaSession.open({ id: 'aula-1', handle: { getFile: vi.fn().mockRejectedValue(new DOMException('gone', 'NotFoundError')) } }))
      .rejects.toMatchObject({ code: 'file-unavailable' });
  });

  it('revokes the primary URL when its sidecar became unavailable', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:primary'), revokeObjectURL });
    const item = itemWithSrt('00:00:01,000 --> 00:00:02,000\nOlá');
    item.sidecarHandle = { getFile: vi.fn().mockRejectedValue(new DOMException('gone', 'NotFoundError')) };

    await expect(LocalMediaSession.open(item)).rejects.toMatchObject({ code: 'file-unavailable' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:primary');
  });
});
