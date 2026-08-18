// src/pages/AudioPage.js
import { AudioPlayer } from '@components/AudioPlayer.js';
import { Playlist } from '@components/Playlist.js';

export class AudioPage {
  constructor(options = {}) {
    this.app = options.app;
    this.audioPlayer = null;
    this.playlist = null;
    this.element = null;
    
    this.audioItems = [
      {
        id: 1,
        title: 'História do Brasil - Período Colonial',
        artist: 'Prof. Fernando Oliveira',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        duration: 374,
        subject: 'História',
        type: 'audio',
        chapters: [
          { time: 0, title: 'Introdução' },
          { time: 45, title: 'Descobrimento do Brasil' },
          { time: 120, title: 'Período Colonial' },
          { time: 200, title: 'Capitanias Hereditárias' },
          { time: 280, title: 'Administração Portuguesa' },
          { time: 340, title: 'Considerações Finais' }
        ]
      },
      {
        id: 2,
        title: 'Biologia - Sistema Nervoso',
        artist: 'Profa. Lucia Fernandes',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        duration: 418,
        subject: 'Biologia',
        type: 'audio',
        chapters: [
          { time: 0, title: 'Visão Geral' },
          { time: 60, title: 'Neurônios' },
          { time: 150, title: 'Sistema Nervoso Central' },
          { time: 250, title: 'Sistema Nervoso Periférico' },
          { time: 350, title: 'Resumo' }
        ]
      },
      {
        id: 3,
        title: 'Geografia - Relevo Brasileiro',
        artist: 'Prof. Ricardo Mendes',
        src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        duration: 302,
        subject: 'Geografia',
        type: 'audio'
      }
    ];
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'audio-page';
    
    this.audioPlayer = new AudioPlayer({
      src: this.audioItems[0].src,
      title: this.audioItems[0].title,
      artist: this.audioItems[0].artist,
      duration: this.audioItems[0].duration,
      chapters: this.audioItems[0].chapters || [],
      onPlay: () => this.onAudioPlay(),
      onPause: () => this.onAudioPause(),
      onTimeUpdate: (time, duration) => this.onTimeUpdate(time, duration),
      onChapterChange: (chapter, index) => this.onChapterChange(chapter, index),
      onSleepTimerEnd: () => this.onSleepTimerEnd()
    });

    this.playlist = new Playlist({
      items: this.audioItems,
      currentIndex: 0,
      onPlay: () => this.onPlaylistPlay(),
      onSelect: (item, index) => this.onPlaylistSelect(item, index),
      onRemove: (index) => this.onPlaylistRemove(index),
      onReorder: (items) => this.onPlaylistReorder(items),
      onClear: () => this.onPlaylistClear()
    });

    this.element.innerHTML = `
      <div class="page-header">
        <h1>Áudios</h1>
        <p>Ouça aulas em áudio e acompanhe o progresso</p>
      </div>
      
      <div class="audio-page-content">
        <div class="audio-main">
          <div class="audio-player-container"></div>
        </div>
        <div class="audio-sidebar">
          <div class="audio-playlist-container"></div>
        </div>
      </div>
    `;

    const playerContainer = this.element.querySelector('.audio-player-container');
    const playlistContainer = this.element.querySelector('.audio-playlist-container');

    playerContainer.appendChild(this.audioPlayer.render());
    playlistContainer.appendChild(this.playlist.render());

    // Connect player to app's mini player
    this.connectToMiniPlayer();

    return this.element;
  }

  connectToMiniPlayer() {
    if (!this.app) return;

    // Override player callbacks to sync with mini player
    this.audioPlayer.onPlay = () => {
      this.app.miniPlayer.setTrack({
        title: this.audioItems[this.playlist.currentIndex].title,
        artist: this.audioItems[this.playlist.currentIndex].artist,
        type: 'audio',
        duration: this.audioItems[this.playlist.currentIndex].duration
      });
      this.app.miniPlayer.play();
    };

    this.audioPlayer.onPause = () => {
      this.app.miniPlayer.pause();
    };

    this.audioPlayer.onTimeUpdate = (time, duration) => {
      this.app.miniPlayer.setProgress(time, duration);
    };
  }

  onAudioPlay() {
    console.log('Audio playing');
  }

  onAudioPause() {
    console.log('Audio paused');
  }

  onTimeUpdate(time, duration) {
    // Could update progress UI
  }

  onChapterChange(chapter, index) {
    console.log('Chapter changed:', chapter.title);
  }

  onSleepTimerEnd() {
    console.log('Sleep timer ended');
    // Could show a toast notification
  }

  onPlaylistPlay() {
    this.audioPlayer.togglePlayPause();
  }

  onPlaylistSelect(item, index) {
    this.audioPlayer.setTrack({
      src: item.src,
      title: item.title,
      artist: item.artist,
      album: item.subject,
      duration: item.duration,
      chapters: item.chapters || []
    });
    this.audioPlayer.play();
  }

  onPlaylistRemove(index) {
    console.log('Removed from playlist:', index);
  }

  onPlaylistReorder(items) {
    console.log('Playlist reordered');
  }

  onPlaylistClear() {
    this.audioPlayer.pause();
    this.audioPlayer.setSrc('');
  }

  destroy() {
    this.audioPlayer?.destroy();
    this.playlist?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
