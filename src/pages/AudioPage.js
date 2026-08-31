import { AudioPlayer } from '@components/AudioPlayer.js';
import { TranscriptPanel } from '@components/TranscriptPanel.js';
import { LocalMediaSession } from '@services/localMediaSession.js';

export class AudioPage {
  constructor(options = {}) { this.app = options.app; this.library = options.library; this.audioPlayer = null; this.transcriptPanel = null; this.session = null; this.element = null; }
  async render() {
    const item = this.app?.consumeLocalResource?.('audio');
    this.element = document.createElement('section');
    this.element.className = 'audio-page';
    this.element.innerHTML = '<header class="page-header"><h1>Áudios</h1><p>Ouça materiais da sua biblioteca local.</p></header><div class="audio-player-container"></div><div class="transcript-container"></div><p class="local-media-state"></p>';
    if (!item) return this.empty('Selecione um áudio na biblioteca local.');
    try {
      this.session = await LocalMediaSession.open(item, this.library);
      this.audioPlayer = new AudioPlayer({ title: item.title });
      this.element.querySelector('.audio-player-container').appendChild(this.audioPlayer.render());
      this.audioPlayer.setTrack({ src: this.session.src, title: item.title, artist: item.area || '', album: item.collection || '' });
      if (item.transcript?.kind === 'text' && this.session.transcriptText) {
        this.transcriptPanel = new TranscriptPanel({ text: this.session.transcriptText });
        this.element.querySelector('.transcript-container').appendChild(this.transcriptPanel.render());
      }
    } catch (error) { this.empty(error.message); }
    return this.element;
  }
  empty(message) { this.element.querySelector('.local-media-state').textContent = message; return this.element; }
  destroy() { this.audioPlayer?.destroy(); this.session?.close(); if (this.element?.parentNode) this.element.parentNode.removeChild(this.element); }
}
