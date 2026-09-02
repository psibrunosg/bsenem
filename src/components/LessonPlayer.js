import { LocalMediaSession } from '@services/localMediaSession.js';
import { TranscriptPanel } from '@components/TranscriptPanel.js';

const MODES = new Set(['video', 'audio']);

export class LessonPlayer {
  constructor({ lesson, initialMode = 'video', library = null, onPlayback = () => {} } = {}) {
    this.lesson = lesson;
    this.initialMode = initialMode;
    this.library = library;
    this.onPlayback = onPlayback;
    this.element = null;
    this.media = null;
    this.mode = null;
    this.session = null;
    this.transcriptPanel = null;
    this.intendedPlaying = false;
    this.lastPlaybackTime = 0;
    this.mediaListeners = [];
    this.destroyed = false;
  }

  async render() {
    if (this.element) return this.element;
    if (!this.lesson) throw new Error('Arquivo local indisponível. Atualize a biblioteca e tente novamente.');

    this.element = document.createElement('section');
    this.element.className = 'lesson-player';
    this.element.innerHTML = `
      <div class="lesson-player-layout">
        <div class="lesson-player-main">
          <header class="lesson-player-heading">
            <div>
              <p class="lesson-player-eyebrow">Aula local</p>
              <h2 class="lesson-player-title"></h2>
            </div>
            <div class="lesson-player-format-slot"></div>
          </header>
          <div class="lesson-player-media-host"></div>
          <p class="lesson-player-status" role="status" aria-live="polite"></p>
          <div class="lesson-player-controls" aria-label="Controles de reprodução">
            <div class="lesson-player-primary-controls">
              <button type="button" class="btn btn-secondary" data-action="previous">Anterior</button>
              <button type="button" class="btn btn-secondary" data-action="rewind">Voltar 10s</button>
              <button type="button" class="btn btn-primary" data-action="play">Reproduzir</button>
              <button type="button" class="btn btn-secondary" data-action="forward">Avançar 10s</button>
              <button type="button" class="btn btn-secondary" data-action="next">Próxima</button>
            </div>
            <label class="lesson-player-seek-label">
              <span>Posição</span>
              <input type="range" min="0" max="0" step="0.1" value="0" data-control="seek" aria-label="Posição da reprodução">
            </label>
            <div class="lesson-player-secondary-controls">
              <button type="button" class="btn btn-secondary" data-action="mute" aria-pressed="false">Silenciar</button>
              <label>
                <span>Volume</span>
                <input type="range" min="0" max="1" step="0.05" value="1" data-control="volume" aria-label="Volume">
              </label>
              <label>
                <span>Velocidade</span>
                <select data-control="rate" aria-label="Velocidade de reprodução">
                  <option value="0.5">0,5x</option>
                  <option value="0.75">0,75x</option>
                  <option value="1" selected>1x</option>
                  <option value="1.25">1,25x</option>
                  <option value="1.5">1,5x</option>
                  <option value="2">2x</option>
                </select>
              </label>
            </div>
          </div>
          <div class="lesson-player-transcript"></div>
        </div>
        <aside class="lesson-player-queue" aria-label="Aulas do módulo">
          <h3>Aulas do módulo</h3>
          <ol></ol>
        </aside>
      </div>
    `;
    this.bindControls();
    const mode = this.availableMode(this.initialMode, this.lesson);
    if (!mode) throw new Error('Arquivo local indisponível. Atualize a biblioteca e tente novamente.');
    await this.replaceMedia(mode, defaultPlaybackState());
    return this.element;
  }

  async switchMode(mode) {
    if (!MODES.has(mode) || !this.lesson?.[mode]) return false;
    if (mode === this.mode) return true;
    return this.replaceMedia(mode, this.capturePlaybackState());
  }

  async selectLesson(lesson) {
    if (!lesson || lesson.id === this.lesson?.id) return false;
    const carried = this.capturePlaybackState();
    carried.currentTime = 0;
    const mode = this.availableMode(this.mode, lesson);
    if (!mode) return false;
    const previousLesson = this.lesson;
    this.lesson = lesson;
    try {
      const changed = await this.replaceMedia(mode, carried);
      if (!changed) this.lesson = previousLesson;
      return changed;
    } catch (error) {
      this.lesson = previousLesson;
      throw error;
    }
  }

  async replaceMedia(mode, playbackState) {
    const item = this.lesson?.[mode];
    if (!item || this.destroyed) return false;

    let nextSession;
    try {
      nextSession = await LocalMediaSession.open(item, this.library);
    } catch (error) {
      this.setStatus(`${error.message} Atualize a biblioteca e tente novamente.`);
      return false;
    }
    if (this.destroyed) {
      nextSession.close();
      return false;
    }

    const media = document.createElement(mode);
    media.className = 'lesson-player-media';
    media.preload = 'metadata';
    media.src = nextSession.src;
    if (mode === 'video') {
      media.playsInline = true;
      for (const caption of nextSession.captions) media.appendChild(captionTrack(caption));
    }

    media.volume = finiteVolume(playbackState.volume);
    media.muted = Boolean(playbackState.muted);
    media.playbackRate = finiteRate(playbackState.playbackRate);

    try {
      const ready = metadataReady(media);
      media.load();
      await ready;
    } catch {
      this.releaseMedia(media);
      nextSession.close();
      this.setStatus('Arquivo local indisponÃ­vel. Atualize a biblioteca e tente novamente.');
      return false;
    }
    if (this.destroyed) {
      this.releaseMedia(media);
      nextSession.close();
      return false;
    }

    const duration = Number.isFinite(media.duration) ? Math.max(0, media.duration) : null;
    const carriedTime = finiteTime(playbackState.currentTime);
    media.currentTime = duration === null ? carriedTime : Math.min(carriedTime, duration);

    this.removeMediaListeners();
    this.releaseMedia();
    this.session?.close();
    this.session = nextSession;
    this.mode = mode;
    this.media = media;
    this.intendedPlaying = Boolean(playbackState.intendedPlaying);
    this.lastPlaybackTime = media.currentTime;
    this.bindMedia(media);

    const host = this.element.querySelector('.lesson-player-media-host');
    host.replaceChildren(media);
    this.renderTitle();
    this.renderFormatToggle();
    this.renderQueue();
    this.renderTranscript();
    this.setStatus('');
    this.syncControls();

    if (this.intendedPlaying) {
      try {
        await media.play();
      } catch {
        this.intendedPlaying = false;
        this.setStatus('Reprodução pausada. Selecione Reproduzir para continuar.');
        this.syncPlayControl();
      }
    }
    return true;
  }

  bindControls() {
    this.element.querySelector('[data-action="play"]').addEventListener('click', () => this.togglePlayback());
    this.element.querySelector('[data-action="rewind"]').addEventListener('click', () => this.seekBy(-10));
    this.element.querySelector('[data-action="forward"]').addEventListener('click', () => this.seekBy(10));
    this.element.querySelector('[data-action="previous"]').addEventListener('click', () => this.moveInQueue(-1));
    this.element.querySelector('[data-action="next"]').addEventListener('click', () => this.moveInQueue(1));
    this.element.querySelector('[data-action="mute"]').addEventListener('click', () => {
      if (!this.media) return;
      this.media.muted = !this.media.muted;
      this.media.dispatchEvent(new Event('volumechange'));
    });
    this.element.querySelector('[data-control="seek"]').addEventListener('input', (event) => {
      if (!this.media) return;
      this.media.currentTime = clampTime(event.currentTarget.value, this.media.duration);
      this.media.dispatchEvent(new Event('timeupdate'));
    });
    this.element.querySelector('[data-control="volume"]').addEventListener('input', (event) => {
      if (!this.media) return;
      this.media.volume = finiteVolume(event.currentTarget.value);
      this.media.dispatchEvent(new Event('volumechange'));
    });
    this.element.querySelector('[data-control="rate"]').addEventListener('change', (event) => {
      if (!this.media) return;
      this.media.playbackRate = finiteRate(event.currentTarget.value);
      this.media.dispatchEvent(new Event('ratechange'));
    });
  }

  bindMedia(media) {
    this.listen(media, 'play', () => {
      this.intendedPlaying = true;
      this.setStatus('');
      this.syncPlayControl();
      this.emitPlayback(true);
    });
    this.listen(media, 'pause', () => {
      if (this.destroyed || media !== this.media) return;
      this.intendedPlaying = false;
      this.syncPlayControl();
      this.emitPlayback(false);
    });
    this.listen(media, 'ended', () => {
      this.intendedPlaying = false;
      this.syncPlayControl();
      this.emitPlayback(false);
    });
    this.listen(media, 'timeupdate', () => {
      this.syncTimeControl();
      this.emitPlayback(!media.paused);
    });
    this.listen(media, 'volumechange', () => this.syncVolumeControls());
    this.listen(media, 'ratechange', () => this.syncRateControl());
    this.listen(media, 'loadedmetadata', () => this.syncTimeControl());
    this.listen(media, 'error', () => this.setStatus('Arquivo local indisponível. Atualize a biblioteca e tente novamente.'));
  }

  listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.mediaListeners.push([target, type, listener]);
  }

  removeMediaListeners() {
    for (const [target, type, listener] of this.mediaListeners) target.removeEventListener(type, listener);
    this.mediaListeners = [];
  }

  releaseMedia(media = this.media) {
    if (!media) return;
    media.pause();
    media.removeAttribute('src');
    media.load();
  }

  async togglePlayback() {
    if (!this.media) return;
    if (!this.media.paused) {
      this.intendedPlaying = false;
      this.media.pause();
      return;
    }
    this.intendedPlaying = true;
    try {
      await this.media.play();
      this.setStatus('');
    } catch {
      this.intendedPlaying = false;
      this.setStatus('Reprodução pausada. Selecione Reproduzir para continuar.');
      this.syncPlayControl();
    }
  }

  seekBy(seconds) {
    if (!this.media) return;
    this.media.currentTime = clampTime(this.media.currentTime + seconds, this.media.duration);
    this.media.dispatchEvent(new Event('timeupdate'));
  }

  async moveInQueue(offset) {
    const lessons = this.moduleLessons();
    const current = lessons.findIndex((lesson) => lesson.id === this.lesson?.id);
    const next = lessons[current + offset];
    if (next) await this.selectLesson(next);
  }

  capturePlaybackState() {
    if (!this.media) return defaultPlaybackState();
    return {
      currentTime: finiteTime(this.media.currentTime),
      volume: finiteVolume(this.media.volume),
      muted: Boolean(this.media.muted),
      playbackRate: finiteRate(this.media.playbackRate),
      intendedPlaying: Boolean(this.intendedPlaying)
    };
  }

  availableMode(preferred, lesson) {
    if (MODES.has(preferred) && lesson?.[preferred]) return preferred;
    if (lesson?.video) return 'video';
    if (lesson?.audio) return 'audio';
    return null;
  }

  moduleLessons() {
    const module = findModule(this.library?.catalog?.courses || [], this.lesson?.moduleId);
    return module?.lessons?.length ? module.lessons : this.lesson ? [this.lesson] : [];
  }

  renderTitle() {
    this.element.querySelector('.lesson-player-title').textContent = this.lesson?.title || 'Aula local';
  }

  renderFormatToggle() {
    const slot = this.element.querySelector('.lesson-player-format-slot');
    slot.replaceChildren();
    if (!this.lesson?.video || !this.lesson?.audio) return;
    const group = document.createElement('div');
    group.className = 'lesson-player-format-toggle';
    group.setAttribute('aria-label', 'Formato da aula');
    for (const [mode, label] of [['video', 'Vídeo'], ['audio', 'Áudio']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(this.mode === mode));
      button.addEventListener('click', () => this.switchMode(mode));
      group.appendChild(button);
    }
    slot.appendChild(group);
  }

  renderQueue() {
    const list = this.element.querySelector('.lesson-player-queue ol');
    list.replaceChildren();
    const lessons = this.moduleLessons();
    lessons.forEach((lesson, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lesson-player-queue-item';
      button.dataset.lessonId = lesson.id;
      button.setAttribute('aria-current', String(lesson.id === this.lesson?.id));
      const order = document.createElement('span');
      order.className = 'lesson-player-queue-order';
      order.textContent = String(index + 1).padStart(2, '0');
      const title = document.createElement('span');
      title.textContent = lesson.title || 'Aula local';
      button.append(order, title);
      button.addEventListener('click', () => this.selectLesson(lesson));
      item.appendChild(button);
      list.appendChild(item);
    });
    const current = lessons.findIndex((lesson) => lesson.id === this.lesson?.id);
    this.element.querySelector('[data-action="previous"]').disabled = current <= 0;
    this.element.querySelector('[data-action="next"]').disabled = current < 0 || current >= lessons.length - 1;
  }

  renderTranscript() {
    const container = this.element.querySelector('.lesson-player-transcript');
    container.replaceChildren();
    this.transcriptPanel = null;
    if (!this.session?.transcriptText) return;
    this.transcriptPanel = new TranscriptPanel({ text: this.session.transcriptText });
    container.appendChild(this.transcriptPanel.render());
  }

  syncControls() {
    this.syncTimeControl();
    this.syncVolumeControls();
    this.syncRateControl();
    this.syncPlayControl();
  }

  syncTimeControl() {
    if (!this.media || !this.element) return;
    const seek = this.element.querySelector('[data-control="seek"]');
    seek.max = String(Number.isFinite(this.media.duration) ? Math.max(0, this.media.duration) : 0);
    seek.value = String(finiteTime(this.media.currentTime));
  }

  syncVolumeControls() {
    if (!this.media || !this.element) return;
    this.element.querySelector('[data-control="volume"]').value = String(this.media.volume);
    const mute = this.element.querySelector('[data-action="mute"]');
    mute.setAttribute('aria-pressed', String(this.media.muted));
    mute.textContent = this.media.muted ? 'Ativar som' : 'Silenciar';
  }

  syncRateControl() {
    if (!this.media || !this.element) return;
    this.element.querySelector('[data-control="rate"]').value = String(this.media.playbackRate);
  }

  syncPlayControl() {
    if (!this.media || !this.element) return;
    this.element.querySelector('[data-action="play"]').textContent = this.intendedPlaying && !this.media.paused ? 'Pausar' : 'Reproduzir';
  }

  emitPlayback(playing) {
    if (!this.media || this.destroyed) return;
    const currentTime = finiteTime(this.media.currentTime);
    const previousTime = finiteTime(this.lastPlaybackTime);
    this.onPlayback({ lesson: this.lesson, mode: this.mode, previousTime, currentTime, playing: Boolean(playing) });
    this.lastPlaybackTime = currentTime;
  }

  setStatus(message) {
    if (this.element) this.element.querySelector('.lesson-player-status').textContent = message;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeMediaListeners();
    this.releaseMedia();
    this.session?.close();
    this.session = null;
    this.media = null;
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

function defaultPlaybackState() {
  return { currentTime: 0, volume: 1, muted: false, playbackRate: 1, intendedPlaying: false };
}

function finiteTime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function finiteVolume(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 1;
}

function finiteRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function clampTime(value, duration) {
  const time = finiteTime(value);
  return Number.isFinite(duration) ? Math.min(time, Math.max(0, duration)) : time;
}

function metadataReady(media) {
  if (media.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const loaded = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error('Arquivo local indisponível.'));
    };
    const cleanup = () => {
      media.removeEventListener('loadedmetadata', loaded);
      media.removeEventListener('error', failed);
    };
    media.addEventListener('loadedmetadata', loaded, { once: true });
    media.addEventListener('error', failed, { once: true });
  });
}

function captionTrack(caption) {
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.src = caption.src;
  track.srclang = caption.lang;
  track.label = caption.label;
  track.default = Boolean(caption.default);
  return track;
}

function findModule(courses, moduleId) {
  for (const course of courses) {
    const found = findModuleIn(course.modules || [], moduleId);
    if (found) return found;
  }
  return null;
}

function findModuleIn(modules, moduleId) {
  for (const module of modules) {
    if (module.id === moduleId) return module;
    const found = findModuleIn(module.children || [], moduleId);
    if (found) return found;
  }
  return null;
}
