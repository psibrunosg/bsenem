// src/pages/VideoPage.js
import { VideoPlayer } from '@components/VideoPlayer.js';
import { Playlist } from '@components/Playlist.js';
import { Switch } from '@components/Switch.js';
import { api } from '@utils/api.js';

export class VideoPage {
  constructor(options = {}) {
    this.app = options.app;
    this.videoPlayer = null;
    this.playlist = null;
    this.modeSwitch = null;
    this.isInteractiveMode = localStorage.getItem('studyMode') !== 'traditional';
    this.element = null;
    
    this.videoItems = [
      {
        id: 1,
        title: 'Introdução à Matemática - Funções Quadráticas',
        artist: 'Prof. Carlos Silva',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        duration: 596,
        subject: 'Matemática',
        breakpoints: [
          {
            time: 10,
            question: 'Qual é o coeficiente que determina a concavidade da parábola em uma função quadrática f(x) = ax² + bx + c?',
            options: ['O coeficiente c', 'O coeficiente b', 'O coeficiente a', 'O discriminante (delta)'],
            answer: 2
          },
          {
            time: 180,
            question: 'Se a > 0, a concavidade da parábola é voltada para:',
            options: ['Cima', 'Baixo', 'Direita', 'Esquerda'],
            answer: 0
          }
        ]
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
      breakpoints: this.isInteractiveMode ? this.videoItems[0].breakpoints : [],
      onPlay: () => this.onVideoPlay(),
      onPause: () => this.onVideoPause(),
      onTimeUpdate: (time, duration) => this.onTimeUpdate(time, duration),
      onEnded: () => this.onVideoEnded()
    });

    this.modeSwitch = new Switch({
      checked: this.isInteractiveMode,
      label: 'Modo Interativo (Microlearning)',
      description: 'Pausa o vídeo para quizzes rápidos.',
      onChange: (checked) => {
        this.isInteractiveMode = checked;
        localStorage.setItem('studyMode', checked ? 'interactive' : 'traditional');
        
        // Update current video breakpoints
        const currentItem = this.videoItems[this.playlist.currentIndex];
        this.videoPlayer.setBreakpoints(checked ? currentItem.breakpoints : []);
      }
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
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1>Videoaulas</h1>
          <p>Assista videoaulas e acompanhe o progresso</p>
        </div>
        <div class="page-header-actions"></div>
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
    const headerActions = this.element.querySelector('.page-header-actions');

    playerContainer.appendChild(this.videoPlayer.render());
    playlistContainer.appendChild(this.playlist.render());
    headerActions.appendChild(this.modeSwitch.render());

    // Connect player to app's mini player
    this.connectToMiniPlayer();
    
    window.addEventListener('video-clip-created', async (e) => {
      const { time, text, title } = e.detail;
      const formattedTime = this.videoPlayer.formatTime(time);
      
      const content = `[${formattedTime}] ${title}\n> ${text || 'Corte marcado.'}\n\n`;
      
      try {
        await api.post('/notes', {
          title: `Anotações: ${title}`,
          content: content
        });
        
        // Show a quick notification
        const toast = document.createElement('div');
        toast.className = 'toast success animate-slide-up';
        toast.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Corte salvo nas Anotações! [${formattedTime}]`;
        toast.style.position = 'fixed';
        toast.style.bottom = '80px';
        toast.style.right = '24px';
        toast.style.zIndex = '9999';
        toast.style.background = 'var(--success)';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = 'var(--radius-md)';
        toast.style.display = 'flex';
        toast.style.gap = '8px';
        toast.style.alignItems = 'center';
        toast.style.boxShadow = 'var(--shadow-lg)';
        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons(toast);
        
        setTimeout(() => toast.remove(), 3000);
      } catch (err) {
        console.error('Failed to save clip to notes', err);
      }
    });

    // Listen for local files
    window.addEventListener('play-local-video', (e) => {
      this.videoPlayer.setSrc(e.detail.src);
      this.videoPlayer.setTitle(e.detail.title);
      if (e.detail.subtitles) {
        this.videoPlayer.setSubtitles(e.detail.subtitles);
      }
      this.element.querySelector('.video-title').textContent = e.detail.title;
      this.element.querySelector('.video-artist').textContent = 'Arquivo Local';
      this.element.querySelector('.video-subject').textContent = 'Biblioteca Local';
      this.videoPlayer.setBreakpoints([]); // Local files don't have built-in breakpoints yet
      this.videoPlayer.play();
    });

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

  async onVideoEnded() {
    // Record study session to SQL backend
    try {
      const currentItem = this.videoItems[this.playlist.currentIndex];
      const durationInSeconds = currentItem ? currentItem.duration : 0;
      if (durationInSeconds > 0) {
        await api.post('/progress/study', {
          type: 'video',
          duration: durationInSeconds
        });
      }
    } catch (e) {
      console.error('Failed to record video study session', e);
    }

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
    this.videoPlayer.setBreakpoints(this.isInteractiveMode ? item.breakpoints : []);
    this.videoPlayer.setSubtitles(item.subtitles || []);
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





