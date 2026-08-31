import { VideoPlayer } from '@components/VideoPlayer.js';
import { LocalMediaSession } from '@services/localMediaSession.js';

export class VideoPage {
  constructor(options = {}) { this.app = options.app; this.library = options.library; this.videoPlayer = null; this.session = null; this.element = null; }
  async render() {
    const item = this.app?.consumeLocalResource?.('video');
    this.element = document.createElement('section');
    this.element.className = 'video-page';
    this.element.innerHTML = '<header class="page-header"><h1>Videoaulas</h1><p>Reproduza materiais da sua biblioteca local.</p></header><div class="video-player-container"></div><p class="local-media-state"></p>';
    if (!item) return this.empty('Selecione uma videoaula na biblioteca local.');
    try {
      this.session = await LocalMediaSession.open(item, this.library);
      this.videoPlayer = new VideoPlayer({ title: item.title });
      this.element.querySelector('.video-player-container').appendChild(this.videoPlayer.render());
      this.videoPlayer.setSrc(this.session.src);
      this.videoPlayer.setSubtitles(this.session.captions);
    } catch (error) { this.empty(error.message); }
    return this.element;
  }
  empty(message) { this.element.querySelector('.local-media-state').textContent = message; return this.element; }
  destroy() { this.videoPlayer?.destroy(); this.session?.close(); if (this.element?.parentNode) this.element.parentNode.removeChild(this.element); }
}
