import { LessonPlayer } from '@components/LessonPlayer.js';

export class VideoPage {
  constructor(options = {}) { this.app = options.app; this.library = options.library; this.player = null; this.element = null; }
  async render() {
    const pending = this.app?.consumeLocalLesson?.();
    this.element = document.createElement('section');
    this.element.className = 'video-page';
    this.element.innerHTML = '<header class="page-header"><h1>Videoaulas</h1><p>Reproduza materiais da sua biblioteca local.</p></header><div class="lesson-player-container"></div><p class="local-media-state" role="status"></p>';
    if (!pending) return this.empty('Selecione uma videoaula na biblioteca local.');
    if (!pending.lesson) return this.empty(pending.error || 'Arquivo local indisponível. Atualize a biblioteca e tente novamente.');
    try {
      this.player = new LessonPlayer({ lesson: pending.lesson, initialMode: 'video', library: this.library });
      this.element.querySelector('.lesson-player-container').appendChild(await this.player.render());
    } catch (error) { this.player?.destroy(); this.empty(error.message); }
    return this.element;
  }
  empty(message) { this.element.querySelector('.local-media-state').textContent = message; return this.element; }
  destroy() { this.player?.destroy(); if (this.element?.parentNode) this.element.parentNode.removeChild(this.element); }
}
