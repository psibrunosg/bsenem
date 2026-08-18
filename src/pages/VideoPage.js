// src/pages/VideoPage.js
import { VideoPlayer } from '@components/VideoPlayer.js';
import { Playlist } from '@components/Playlist.js';

export class VideoPage {
  constructor(options = {}) {
    this.app = options.app;
    this.videoPlayer = null;
    this.playlist = null;
    this.element = null;
    
    this.videoItems = [
      {
        id: 1,
        title: 'Introdução à Matemática - Funções Quadráticas',
        artist: 'Prof. Carlos Silva',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        duration: 596,
        subject: 'Matemática'
      },
      {
        id: 2,
        title: 'Física Mecânica - Leis de Newton',
        artist: 'Prof. Ana Costa',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        duration: 653,
        subject: 'Física'
      },
      {
        id: 3,
        title: 'Química Orgânica - Hidrocarbonetos',
        artist: 'Prof. Maria Santos',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        duration: 15,
        subject: 'Química'
      }
    ];
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'video-page';
    
    this.videoPlayer = new VideoPlayer({
      src: this.videoItems[0].src,
      poster: this.videoItems[0].poster,
      title: this.videoItems[0].title,
      description: this.videoItems[0].artist,
      duration: this.videoItems[0].duration,
      onPlay: () => this.onVideoPlay(),
      onPause: () => this.onVideoPause(),
      onTimeUpdate: (time, duration) => this.onTimeUpdate(time, duration),
      onEnded: () => this.onVideoEnded()
    });

    this.playlist = new Playlist({
      items: this.videoItems,
      currentIndex: 0,
      onPlay: () => this.onPlaylistPlay(),
      onSelect: (item, index) => this.onPlaylistSelect(item, index),
      onRemove: (index) => this.onPlaylistRemove(index),
      onReorder: (items) => this.onPlaylistReorder(items),
      onClear: () => this.onPlaylistClear()
    });

    this.element.innerHTML = `
      <div class="page-header">
        <h1>Videoaulas</h1>
        <p>Assista videoaulas e acompanhe o progresso</p>
      </div>
      
      <div class="video-page-content">
        <div class="video-main">
          <div class="video-player-container"></div>
          <div class="video-info-panel">
            <h2 class="video-title">${this.videoItems[0].title}</h2>
            <p class="video-artist">${this.videoItems[0].artist}</p>
            <p class="video-subject">${this.videoItems[0].subject}</p>
          </div>
        </div>
        <div class="video-sidebar">
          <div class="video-playlist-container"></div>
        </div>
      </div>
    `;

    const playerContainer = this.element.querySelector('.video-player-container');
    const playlistContainer = this.element.querySelector('.video-playlist-container');

    playerContainer.appendChild(this.videoPlayer.render());
    playlistContainer.appendChild(this.playlist.render());

    // Connect player to app's mini player
    this.connectToMiniPlayer();

    return this.element;
  }

  connectToMiniPlayer() {
    if (!this.app) return;

    // Override player callbacks to sync with mini player
    this.videoPlayer.onPlay = () => {
      this.app.miniPlayer.setTrack({
        title: this.videoItems[this.playlist.currentIndex].title,
        artist: this.videoItems[this.playlist.currentIndex].artist,
        type: 'video',
        duration: this.videoItems[this.playlist.currentIndex].duration
      });
      this.app.miniPlayer.play();
    };

    this.videoPlayer.onPause = () => {
      this.app.miniPlayer.pause();
    };

    this.videoPlayer.onTimeUpdate = (time, duration) => {
      this.app.miniPlayer.setProgress(time, duration);
    };
  }

  onVideoPlay() {
    console.log('Video playing');
  }

  onVideoPause() {
    console.log('Video paused');
  }

  onTimeUpdate(time, duration) {
    // Could update progress UI
  }

  onVideoEnded() {
    // Play next in playlist
    const nextItem = this.playlist.getNextItem();
    if (nextItem) {
      this.playlist.selectNext();
    }
  }

  onPlaylistPlay() {
    this.videoPlayer.togglePlayPause();
  }

  onPlaylistSelect(item, index) {
    this.videoPlayer.setSrc(item.src, item.poster);
    this.videoPlayer.setTitle(item.title);
    this.videoPlayer.play();
  }

  onPlaylistRemove(index) {
    console.log('Removed from playlist:', index);
  }

  onPlaylistReorder(items) {
    console.log('Playlist reordered');
  }

  onPlaylistClear() {
    this.videoPlayer.pause();
    this.videoPlayer.setSrc('', null);
  }

  destroy() {
    this.videoPlayer?.destroy();
    this.playlist?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
