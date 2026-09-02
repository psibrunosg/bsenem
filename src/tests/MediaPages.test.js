import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioPage } from '../pages/AudioPage.js';
import { VideoPage } from '../pages/VideoPage.js';
import { LibraryPage } from '../pages/LibraryPage.js';

const handle = (file) => ({ getFile: vi.fn().mockResolvedValue(file) });
const localItem = (resourceType, overrides = {}) => ({
  id: `${resourceType}-1`, title: 'Sistema nervoso', resourceType, extension: resourceType === 'video' ? 'mp4' : resourceType === 'audio' ? 'mp3' : 'pdf',
  handle: handle(new File(['conteúdo'], `aula.${resourceType === 'video' ? 'mp4' : resourceType === 'audio' ? 'mp3' : 'pdf'}`)), ...overrides
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function load() {
    Object.defineProperty(this, 'duration', { configurable: true, value: 120 });
    queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, fillRect() {}, scale() {} });
});

function pairedLesson(overrides = {}) {
  return {
    id: 'lesson-1',
    title: 'Sistema nervoso',
    courseId: 'course-1',
    moduleId: 'module-1',
    video: localItem('video'),
    audio: localItem('audio'),
    transcript: null,
    ...overrides
  };
}

function libraryFor(lessons) {
  return {
    catalog: {
      courses: [{ id: 'course-1', title: 'Biologia', modules: [{ id: 'module-1', title: 'Neurociência', children: [], lessons, materials: [] }] }],
      lessons: new Map(lessons.map((lesson) => [lesson.id, lesson])),
      itemToLessonId: new Map(lessons.flatMap((lesson) => [lesson.video, lesson.audio].filter(Boolean).map((item) => [item.id, lesson.id])))
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function renderPlayer(lesson, library = libraryFor([lesson]), options = {}) {
  const { LessonPlayer } = await import('../components/LessonPlayer.js');
  const player = new LessonPlayer({ lesson, initialMode: lesson.video ? 'video' : 'audio', library, ...options });
  await player.render();
  return player;
}

describe('local media pages', () => {
  it('uses the pending local video lesson in the shared full player', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() });
    const lesson = pairedLesson({ audio: null });
    const page = new VideoPage({ app: { consumeLocalLesson: vi.fn(() => ({ lesson, initialMode: 'video' })) }, library: libraryFor([lesson]) });
    const element = await page.render();

    expect(element.querySelector('video').src).toContain('blob:video');
    expect(element.querySelectorAll('.lesson-player')).toHaveLength(1);
    expect(element.querySelectorAll('.lesson-player-queue').length).toBe(1);
    expect(element.querySelector('.lesson-player-format-toggle')).toBeNull();
    expect(element.innerHTML).not.toMatch(/https?:/);
  });

  it('shows a searchable transcript for a local audio TXT sidecar', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:audio'), revokeObjectURL: vi.fn() });
    const audio = localItem('audio', { transcript: { kind: 'text', name: 'aula.txt' }, sidecarHandle: handle({ name: 'aula.txt', text: async () => 'Sistema nervoso central' }) });
    const lesson = pairedLesson({ video: null, audio, transcript: audio.transcript });
    const page = new AudioPage({ app: { consumeLocalLesson: vi.fn(() => ({ lesson, initialMode: 'audio' })) }, library: libraryFor([lesson]) });
    const element = await page.render();

    expect(element.querySelector('audio').src).toContain('blob:audio');
    expect(element.querySelectorAll('.lesson-player')).toHaveLength(1);
    expect(element.querySelectorAll('.lesson-player-queue')).toHaveLength(1);
    expect(element.querySelector('.transcript-panel').textContent).toContain('Sistema nervoso central');
    expect(element.innerHTML).not.toMatch(/https?:/);
  });

  it('opens a local PDF in the viewer from the resource bridge', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() });
    const page = new LibraryPage({ app: { consumeLocalResource: vi.fn(() => localItem('pdf')) }, library: { items: [] } });
    const element = await page.render();

    expect(element.querySelector('.pdf-viewer')).not.toBeNull();
  });

  it('shows an actionable state when a selected item no longer resolves to a lesson', async () => {
    const page = new VideoPage({ app: { consumeLocalLesson: vi.fn(() => ({ lesson: null, initialMode: 'video', error: 'Arquivo local indisponível. Atualize a biblioteca e tente novamente.' })) } });

    const element = await page.render();

    expect(element.querySelector('.local-media-state').textContent).toContain('Atualize a biblioteca');
    expect(element.querySelector('video')).toBeNull();
  });
});

describe('LessonPlayer', () => {
  it('switches a paired lesson without losing time, volume, mute, rate, or intended play state', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL });
    const player = await renderPlayer(pairedLesson());
    player.media.currentTime = 42;
    player.media.volume = 0.4;
    player.media.muted = true;
    player.media.playbackRate = 1.5;
    player.intendedPlaying = true;

    await expect(player.switchMode('audio')).resolves.toBe(true);

    expect(player.mode).toBe('audio');
    expect(player.media.currentTime).toBe(42);
    expect(player.media.volume).toBe(0.4);
    expect(player.media.muted).toBe(true);
    expect(player.media.playbackRate).toBe(1.5);
    expect(player.intendedPlaying).toBe(true);
    expect(player.element.querySelectorAll('video, audio')).toHaveLength(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:aula.mp4');
  });

  it('stops and detaches the previous media element when switching formats', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const player = await renderPlayer(pairedLesson());
    const previousMedia = player.media;
    HTMLMediaElement.prototype.pause.mockClear();

    await player.switchMode('audio');

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();
    expect(previousMedia.getAttribute('src')).toBeNull();
    expect(player.element.querySelectorAll('video, audio')).toHaveLength(1);
  });

  it('keeps the selected format paused and actionable when play resumption is rejected', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const player = await renderPlayer(pairedLesson());
    player.media.currentTime = 36;
    player.media.volume = 0.45;
    player.media.muted = true;
    player.media.playbackRate = 1.25;
    player.intendedPlaying = true;
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));

    await expect(player.switchMode('audio')).resolves.toBe(true);

    expect(player.mode).toBe('audio');
    expect(player.media.currentTime).toBe(36);
    expect(player.media.volume).toBe(0.45);
    expect(player.media.muted).toBe(true);
    expect(player.media.playbackRate).toBe(1.25);
    expect(player.intendedPlaying).toBe(false);
    expect(player.element.querySelector('[data-action="play"]').textContent).toBe('Reproduzir');
    expect(player.element.querySelector('.lesson-player-status').textContent).toContain('Selecione Reproduzir');
  });

  it('keeps the current session when the alternate media cannot load', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL });
    HTMLMediaElement.prototype.load.mockImplementation(function load() {
      if (!this.hasAttribute('src')) return;
      Object.defineProperty(this, 'duration', { configurable: true, value: 120 });
      queueMicrotask(() => this.dispatchEvent(new Event(this.src.endsWith('.mp3') ? 'error' : 'loadedmetadata')));
    });
    const player = await renderPlayer(pairedLesson());
    const previousMedia = player.media;
    player.media.currentTime = 29;
    player.media.volume = 0.35;

    await expect(player.switchMode('audio')).resolves.toBe(false);

    expect(player.mode).toBe('video');
    expect(player.media).toBe(previousMedia);
    expect(player.media.currentTime).toBe(29);
    expect(player.media.volume).toBe(0.35);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:aula.mp3');
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:aula.mp4');
    expect(player.element.querySelector('.lesson-player-status').textContent).toContain('Atualize a biblioteca');
  });

  it('rejects an unavailable format without replacing media or changing playback state', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL });
    const lesson = pairedLesson({ audio: null });
    const player = await renderPlayer(lesson);
    player.media.currentTime = 18;
    player.media.volume = 0.25;
    const originalMedia = player.media;

    await expect(player.switchMode('audio')).resolves.toBe(false);

    expect(player.mode).toBe('video');
    expect(player.media).toBe(originalMedia);
    expect(player.media.currentTime).toBe(18);
    expect(player.media.volume).toBe(0.25);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(player.element.querySelector('.lesson-player-format-toggle')).toBeNull();
  });

  it('uses the player controls to change rate, seek, and move through the single module queue', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const first = pairedLesson();
    const second = pairedLesson({ id: 'lesson-2', title: 'Medula espinhal', video: localItem('video', { id: 'video-2' }), audio: null });
    const player = await renderPlayer(first, libraryFor([first, second]));
    const rate = player.element.querySelector('[data-control="rate"]');

    rate.value = '1.5';
    rate.dispatchEvent(new Event('change', { bubbles: true }));
    player.media.currentTime = 12;
    player.element.querySelector('[data-action="forward"]').click();
    expect(player.media.currentTime).toBe(22);
    await player.moveInQueue(1);

    expect(player.lesson.id).toBe('lesson-2');
    expect(player.media.currentTime).toBe(0);
    expect(player.media.playbackRate).toBe(1.5);
    expect(player.element.querySelectorAll('.lesson-player-queue')).toHaveLength(1);
    expect(player.element.querySelector('[data-lesson-id="lesson-2"]').getAttribute('aria-current')).toBe('true');

    await player.moveInQueue(-1);
    expect(player.lesson.id).toBe('lesson-1');
  });

  it('attributes old-media playback events to the active lesson while another lesson is still loading', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const pendingFile = deferred();
    const first = pairedLesson({ audio: null });
    const second = pairedLesson({
      id: 'lesson-2',
      title: 'Medula espinhal',
      video: localItem('video', { id: 'video-2', handle: { getFile: vi.fn(() => pendingFile.promise) } }),
      audio: null
    });
    const events = [];
    const player = await renderPlayer(first, libraryFor([first, second]), { onPlayback: (event) => events.push(event) });
    const oldMedia = player.media;

    const selection = player.selectLesson(second);
    oldMedia.currentTime = 17;
    oldMedia.dispatchEvent(new Event('timeupdate'));

    expect(player.lesson.id).toBe('lesson-1');
    expect(events.at(-1).lesson.id).toBe('lesson-1');

    pendingFile.resolve(new File(['lesson-2'], 'lesson-2.mp4'));
    await selection;
  });

  it('lets only the newest concurrent lesson selection commit media and render state', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL });
    const fileB = deferred();
    const fileC = deferred();
    const lessonA = pairedLesson({ audio: null });
    const lessonB = pairedLesson({
      id: 'lesson-2',
      title: 'Medula espinhal',
      video: localItem('video', { id: 'video-2', handle: { getFile: vi.fn(() => fileB.promise) } }),
      audio: null
    });
    const lessonC = pairedLesson({
      id: 'lesson-3',
      title: 'Cerebelo',
      video: localItem('video', { id: 'video-3', handle: { getFile: vi.fn(() => fileC.promise) } }),
      audio: null
    });
    const player = await renderPlayer(lessonA, libraryFor([lessonA, lessonB, lessonC]));

    const selectionB = player.selectLesson(lessonB);
    const selectionC = player.selectLesson(lessonC);
    fileC.resolve(new File(['lesson-3'], 'lesson-3.mp4'));
    await expect(selectionC).resolves.toBe(true);
    fileB.resolve(new File(['lesson-2'], 'lesson-2.mp4'));
    await expect(selectionB).resolves.toBe(false);

    expect(player.lesson.id).toBe('lesson-3');
    expect(player.mode).toBe('video');
    expect(player.session.item.id).toBe('video-3');
    expect(player.media.src).toContain('blob:lesson-3.mp4');
    expect(player.element.querySelector('.lesson-player-title').textContent).toBe('Cerebelo');
    expect(player.element.querySelector('[data-lesson-id="lesson-3"]').getAttribute('aria-current')).toBe('true');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:lesson-2.mp4');
  });

  it('aborts and releases a metadata-pending candidate when a newer selection supersedes it', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL });
    const lessonA = pairedLesson({ audio: null });
    const lessonB = pairedLesson({
      id: 'lesson-2',
      title: 'Medula espinhal',
      video: localItem('video', { id: 'video-2', handle: handle(new File(['lesson-2'], 'pending-b.mp4')) }),
      audio: null
    });
    const lessonC = pairedLesson({
      id: 'lesson-3',
      title: 'Cerebelo',
      video: localItem('video', { id: 'video-3', handle: handle(new File(['lesson-3'], 'lesson-c.mp4')) }),
      audio: null
    });
    const player = await renderPlayer(lessonA, libraryFor([lessonA, lessonB, lessonC]));
    const nativeCreateElement = document.createElement.bind(document);
    const candidates = [];
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = nativeCreateElement(tagName, options);
      if (tagName === 'video' || tagName === 'audio') candidates.push(element);
      return element;
    });
    HTMLMediaElement.prototype.load.mockImplementation(function load() {
      if (this.src.endsWith('lesson-c.mp4')) {
        Object.defineProperty(this, 'duration', { configurable: true, value: 120 });
        queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
      }
    });

    let resultB;
    const selectionB = player.selectLesson(lessonB).then((result) => { resultB = result; });
    await vi.waitFor(() => expect(candidates).toHaveLength(1));
    const candidateB = candidates[0];
    const removeEventListener = vi.spyOn(candidateB, 'removeEventListener');

    await expect(player.selectLesson(lessonC)).resolves.toBe(true);
    await vi.waitFor(() => expect(resultB).toBe(false));
    await selectionB;

    expect(candidateB.getAttribute('src')).toBeNull();
    expect(removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending-b.mp4');
    expect(player.lesson.id).toBe('lesson-3');
    expect(player.media.src).toContain('blob:lesson-c.mp4');
  });

  it('aborts and releases a metadata-pending candidate when the player is destroyed', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL });
    const lessonA = pairedLesson({ audio: null });
    const lessonB = pairedLesson({
      id: 'lesson-2',
      title: 'Medula espinhal',
      video: localItem('video', { id: 'video-2', handle: handle(new File(['lesson-2'], 'pending-destroy.mp4')) }),
      audio: null
    });
    const player = await renderPlayer(lessonA, libraryFor([lessonA, lessonB]));
    const nativeCreateElement = document.createElement.bind(document);
    let candidate;
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = nativeCreateElement(tagName, options);
      if (tagName === 'video' || tagName === 'audio') candidate = element;
      return element;
    });
    HTMLMediaElement.prototype.load.mockImplementation(() => {});

    let selectionResult;
    const selection = player.selectLesson(lessonB).then((result) => { selectionResult = result; });
    await vi.waitFor(() => expect(candidate).toBeDefined());
    const removeEventListener = vi.spyOn(candidate, 'removeEventListener');

    player.destroy();
    await vi.waitFor(() => expect(selectionResult).toBe(false));
    await selection;

    expect(candidate.getAttribute('src')).toBeNull();
    expect(removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending-destroy.mp4');
  });

  it('keeps controls synchronized and renders one active module queue safely', async () => {
    vi.stubGlobal('URL', { createObjectURL: vi.fn((file) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const first = pairedLesson({ title: '<img src=x onerror=alert(1)>' });
    const second = pairedLesson({ id: 'lesson-2', title: 'Medula espinhal', video: localItem('video', { id: 'video-2' }), audio: null });
    const player = await renderPlayer(first, libraryFor([first, second]));
    const volume = player.element.querySelector('[data-control="volume"]');
    const mute = player.element.querySelector('[data-action="mute"]');

    volume.value = '0.3';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    mute.click();
    player.media.currentTime = 24;
    player.media.dispatchEvent(new Event('timeupdate'));

    expect(player.media.volume).toBe(0.3);
    expect(player.media.muted).toBe(true);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(player.element.querySelector('[data-control="seek"]').value).toBe('24');
    expect(player.element.querySelectorAll('.lesson-player-queue')).toHaveLength(1);
    expect(player.element.querySelectorAll('.lesson-player-queue [aria-current="true"]')).toHaveLength(1);
    expect(player.element.querySelector('img')).toBeNull();
    expect(player.element.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('closes the current local media session when destroyed', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL });
    const player = await renderPlayer(pairedLesson({ audio: null }));

    player.destroy();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
  });
});
