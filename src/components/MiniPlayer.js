// src/components/MiniPlayer.js
export class MiniPlayer {
  constructor(options = {}) {
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1;
    this.muted = false;
    this.playbackRate = 1;
    this.track = null;
    this.queue = [];
    this.currentIndex = -1;
    this.type = 'audio'; // 'audio' | 'video'
    this.expanded = false;
    
    this.onPlay = options.onPlay ?? (() => {});
    this.onPause = options.onPause ?? (() => {});
    this.onSeek = options.onSeek ?? (() => {});
    this.onVolumeChange = options.onVolumeChange ?? (() => {});
    this.onMuteToggle = options.onMuteToggle ?? (() => {});
    this.onRateChange = options.onRateChange ?? (() => {});
    this.onNext = options.onNext ?? (() => {});
    this.onPrev = options.onPrev ?? (() => {});
    this.onFullscreen = options.onFullscreen ?? (() => {});
    this.onExpand = options.onExpand ?? (() => {});
    
    this.element = null;
    this.seekDragging = false;
    this.volumeDragging = false;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `mini-player ${this.track ? '' : 'empty'} ${this.expanded ? 'expanded' : ''}`;
    this.element.innerHTML = `
      <div class="mini-player-track">
        ${this.track ? this.renderTrackInfo() : this.renderEmptyTrack()}
        <div class="mini-player-info">
          <div class="mini-player-title">${this.track?.title || 'Nenhuma mídia reproduzindo'}</div>
          <div class="mini-player-artist">${this.track?.artist || 'Selecione uma aula ou áudio para começar'}</div>
        </div>
      </div>
      
      <div class="mini-player-controls">
        <button class="mini-player-btn" aria-label="Anterior" data-action="prev" ${!this.track ? 'disabled' : ''}>
          <i data-lucide="skip-back" class="w-5 h-5"></i>
        </button>
        <button class="mini-player-btn play-btn" aria-label="${this.isPlaying ? 'Pausar' : 'Reproduzir'}" data-action="play-pause" ${!this.track ? 'disabled' : ''}>
          <i data-lucide="${this.isPlaying ? 'pause' : 'play'}" class="w-5 h-5"></i>
        </button>
        <button class="mini-player-btn" aria-label="Próximo" data-action="next" ${!this.track ? 'disabled' : ''}>
          <i data-lucide="skip-forward" class="w-5 h-5"></i>
        </button>
      </div>
      
      <div class="mini-player-progress">
        <span class="mini-player-time current">${this.formatTime(this.currentTime)}</span>
        <input 
          type="range" 
          class="mini-player-seek" 
          min="0" 
          max="${this.duration || 100}" 
          value="${this.currentTime}" 
          aria-label="Posição da reprodução"
          data-action="seek"
          ${!this.track ? 'disabled' : ''}
        >
        <div class="mini-player-seek-fill" style="width: ${this.duration ? (this.currentTime / this.duration * 100) : 0}%"></div>
        <span class="mini-player-time total">${this.formatTime(this.duration)}</span>
      </div>
      
      <div class="mini-player-volume">
        <button class="mini-player-volume-btn" aria-label="${this.muted ? 'Ativar som' : 'Silenciar'}" data-action="mute">
          <i data-lucide="${this.muted || this.volume === 0 ? 'volume-x' : this.volume < 0.5 ? 'volume-1' : 'volume-2'}" class="w-5 h-5"></i>
        </button>
        <input 
          type="range" 
          class="mini-player-volume-slider" 
          min="0" 
          max="1" 
          step="0.05" 
          value="${this.muted ? 0 : this.volume}" 
          aria-label="Volume"
          data-action="volume"
          ${this.muted ? 'disabled' : ''}
        >
      </div>
      
      <button class="mini-player-speed" aria-label="Velocidade: ${this.playbackRate}x" data-action="speed" title="Clique para alterar velocidade (S)">
        ${this.playbackRate}x
      </button>
      
      <button class="mini-player-fullscreen" aria-label="Tela cheia (F)" data-action="fullscreen" ${this.type !== 'video' ? 'style="display:none"' : ''}>
        <i data-lucide="maximize" class="w-5 h-5"></i>
      </button>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    return this.element;
  }

  renderTrackInfo() {
    if (!this.track) return '';
    
    if (this.track.thumbnail) {
      return `<img src="${this.track.thumbnail}" alt="" class="mini-player-thumbnail" loading="lazy">`;
    }
    
    const icon = this.track.type === 'video' ? 'play-circle' : 'music';
    return `<div class="mini-player-thumbnail-placeholder"><i data-lucide="${icon}" class="w-6 h-6"></i></div>`;
  }

  renderEmptyTrack() {
    return `<div class="mini-player-thumbnail-placeholder"><i data-lucide="music" class="w-6 h-6"></i></div>`;
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  bindEvents() {
    // Play/Pause
    const playBtn = this.element.querySelector('[data-action="play-pause"]');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.isPlaying) {
          this.pause();
        } else {
          this.play();
        }
      });
    }

    // Prev/Next
    const prevBtn = this.element.querySelector('[data-action="prev"]');
    const nextBtn = this.element.querySelector('[data-action="next"]');
    prevBtn?.addEventListener('click', () => this.onPrev());
    nextBtn?.addEventListener('click', () => this.onNext());

    // Seek
    const seekInput = this.element.querySelector('[data-action="seek"]');
    const seekFill = this.element.querySelector('.mini-player-seek-fill');
    
    if (seekInput) {
      seekInput.addEventListener('mousedown', () => { this.seekDragging = true; });
      seekInput.addEventListener('touchstart', () => { this.seekDragging = true; }, { passive: true });
      
      seekInput.addEventListener('input', (e) => {
        if (this.seekDragging) {
          const value = parseFloat(e.target.value);
          this.currentTime = value;
          this.updateSeekDisplay();
          this.onSeek(value);
        }
      });
      
      seekInput.addEventListener('change', (e) => {
        this.seekDragging = false;
        this.onSeek(parseFloat(e.target.value));
      });
      
      // Click on progress bar
      seekInput.addEventListener('click', (e) => {
        if (!this.seekDragging) {
          const rect = seekInput.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const value = percent * this.duration;
          seekInput.value = value;
          this.currentTime = value;
          this.updateSeekDisplay();
          this.onSeek(value);
        }
      });
    }

    // Volume
    const muteBtn = this.element.querySelector('[data-action="mute"]');
    const volumeSlider = this.element.querySelector('[data-action="volume"]');
    const volumeIcon = muteBtn?.querySelector('i');
    
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.toggleMute();
      });
    }
    
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        this.volume = parseFloat(e.target.value);
        this.muted = this.volume === 0;
        this.updateVolumeDisplay();
        this.onVolumeChange(this.volume);
      });
    }

    // Speed
    const speedBtn = this.element.querySelector('[data-action="speed"]');
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        this.cyclePlaybackRate();
      });
    }

    // Fullscreen
    const fsBtn = this.element.querySelector('[data-action="fullscreen"]');
    fsBtn?.addEventListener('click', () => this.onFullscreen());

    // Global events for drag end
    document.addEventListener('mouseup', () => {
      if (this.seekDragging) {
        this.seekDragging = false;
        this.onSeek(this.currentTime);
      }
      if (this.volumeDragging) this.volumeDragging = false;
    });
  }

  updateSeekDisplay() {
    const seekInput = this.element.querySelector('[data-action="seek"]');
    const seekFill = this.element.querySelector('.mini-player-seek-fill');
    const currentTimeEl = this.element.querySelector('.mini-player-time.current');
    
    if (seekInput) seekInput.value = this.currentTime;
    if (seekFill && this.duration) seekFill.style.width = `${(this.currentTime / this.duration * 100)}%`;
    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(this.currentTime);
  }

  updateVolumeDisplay() {
    const volumeSlider = this.element.querySelector('[data-action="volume"]');
    const muteBtn = this.element.querySelector('[data-action="mute"]');
    const volumeIcon = muteBtn?.querySelector('i');
    
    if (volumeSlider) volumeSlider.value = this.muted ? 0 : this.volume;
    if (volumeIcon) {
      volumeIcon.setAttribute('data-lucide', this.muted || this.volume === 0 ? 'volume-x' : this.volume < 0.5 ? 'volume-1' : 'volume-2');
    }
    if (muteBtn) muteBtn.setAttribute('aria-label', this.muted ? 'Ativar som' : 'Silenciar');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  updatePlayPauseButton() {
    const playBtn = this.element.querySelector('[data-action="play-pause"]');
    const icon = playBtn?.querySelector('i');
    if (playBtn) playBtn.setAttribute('aria-label', this.isPlaying ? 'Pausar' : 'Reproduzir');
    if (icon) icon.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Public methods
  play() {
    if (!this.track) return;
    this.isPlaying = true;
    this.updatePlayPauseButton();
    this.onPlay();
  }

  pause() {
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.onPause();
  }

  togglePlayPause() {
    if (this.isPlaying) this.pause(); else this.play();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.updateVolumeDisplay();
    this.onMuteToggle(this.muted);
  }

  cyclePlaybackRate() {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(this.playbackRate);
    this.playbackRate = rates[(currentIndex + 1) % rates.length];
    
    const speedBtn = this.element.querySelector('[data-action="speed"]');
    if (speedBtn) {
      speedBtn.textContent = `${this.playbackRate}x`;
      speedBtn.setAttribute('aria-label', `Velocidade: ${this.playbackRate}x`);
    }
    this.onRateChange(this.playbackRate);
  }

  setTrack(track) {
    this.track = track;
    this.currentTime = 0;
    this.duration = track.duration || 0;
    this.type = track.type || 'audio';
    
    // Update UI
    const trackEl = this.element.querySelector('.mini-player-track');
    if (trackEl) {
      trackEl.innerHTML = this.renderTrackInfo() + `
        <div class="mini-player-info">
          <div class="mini-player-title">${track.title}</div>
          <div class="mini-player-artist">${track.artist || track.subject || ''}</div>
        </div>
      `;
    }
    
    this.element.classList.remove('empty');
    
    // Update progress
    const seekInput = this.element.querySelector('[data-action="seek"]');
    const totalTimeEl = this.element.querySelector('.mini-player-time.total');
    if (seekInput) {
      seekInput.max = this.duration || 100;
      seekInput.disabled = false;
    }
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(this.duration);
    
    // Enable controls
    this.element.querySelectorAll('[data-action]').forEach(btn => {
      if (btn.tagName === 'BUTTON') btn.disabled = false;
      if (btn.tagName === 'INPUT') btn.disabled = false;
    });
    
    // Show/hide fullscreen for video
    const fsBtn = this.element.querySelector('[data-action="fullscreen"]');
    if (fsBtn) fsBtn.style.display = this.type === 'video' ? 'flex' : 'none';
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  setProgress(currentTime, duration) {
    this.currentTime = currentTime;
    if (duration) this.duration = duration;
    
    if (!this.seekDragging) this.updateSeekDisplay();
    
    const totalTimeEl = this.element.querySelector('.mini-player-time.total');
    if (totalTimeEl && duration) totalTimeEl.textContent = this.formatTime(duration);
  }

  setVolume(volume) {
    this.volume = volume;
    this.muted = volume === 0;
    this.updateVolumeDisplay();
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    const speedBtn = this.element.querySelector('[data-action="speed"]');
    if (speedBtn) {
      speedBtn.textContent = `${rate}x`;
      speedBtn.setAttribute('aria-label', `Velocidade: ${rate}x`);
    }
  }

  setQueue(queue, currentIndex) {
    this.queue = queue;
    this.currentIndex = currentIndex;
  }

  expand() {
    this.expanded = true;
    this.element.classList.add('expanded');
    this.onExpand(true);
  }

  collapse() {
    this.expanded = false;
    this.element.classList.remove('expanded');
    this.onExpand(false);
  }

  showLoading() {
    this.element.classList.add('loading');
  }

  hideLoading() {
    this.element.classList.remove('loading');
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}