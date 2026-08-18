// src/components/AudioPlayer.js
export class AudioPlayer {
  constructor(options = {}) {
    this.src = options.src ?? null;
    this.title = options.title ?? '';
    this.artist = options.artist ?? '';
    this.album = options.album ?? '';
    this.thumbnail = options.thumbnail ?? null;
    this.duration = options.duration ?? 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.volume = 1;
    this.muted = false;
    this.playbackRate = 1;
    this.chapters = options.chapters ?? [];
    this.currentChapter = null;
    this.waveformData = options.waveformData ?? null;
    this.showWaveform = options.showWaveform ?? true;
    
    // Sleep timer
    this.sleepTimer = null;
    this.sleepTimerDuration = null;
    this.sleepTimerRemaining = null;
    this.sleepTimerInterval = null;
    
    // Callbacks
    this.onPlay = options.onPlay ?? (() => {});
    this.onPause = options.onPause ?? (() => {});
    this.onTimeUpdate = options.onTimeUpdate ?? (() => {});
    this.onDurationChange = options.onDurationChange ?? (() => {});
    this.onVolumeChange = options.onVolumeChange ?? (() => {});
    this.onRateChange = options.onRateChange ?? (() => {});
    this.onChapterChange = options.onChapterChange ?? (() => {});
    this.onSleepTimerEnd = options.onSleepTimerEnd ?? (() => {});
    
    this.element = null;
    this.audioElement = null;
    this.waveformCanvas = null;
    this.waveformCtx = null;
    this.isDraggingProgress = false;
    this.isDraggingVolume = false;
    this.lastVolume = 1;
    this.animationFrame = null;
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'audio-player';
    this.element.tabIndex = 0;
    
    this.element.innerHTML = `
      <div class="audio-container">
        <audio class="audio-element" preload="metadata">
          ${this.src ? `<source src="${this.src}" type="audio/mpeg">` : ''}
        </audio>
        
        <div class="audio-header">
          <div class="audio-info">
            ${this.renderThumbnail()}
            <div class="audio-details">
              <h3 class="audio-title">${this.title}</h3>
              <p class="audio-artist">${this.artist}</p>
              ${this.album ? `<p class="audio-album">${this.album}</p>` : ''}
            </div>
          </div>
          <div class="audio-chapters-indicator">
            ${this.chapters.length > 0 ? `
              <button class="audio-chapter-badge" data-action="toggle-chapters">
                <i data-lucide="bookmark" class="w-4 h-4"></i>
                <span class="audio-chapter-name">Capítulo atual</span>
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="audio-waveform-container">
          <canvas class="audio-waveform" aria-label="Forma de onda do áudio"></canvas>
          <div class="audio-waveform-cursor"></div>
          <div class="audio-waveform-progress"></div>
        </div>
        
        <div class="audio-progress-wrapper" data-action="progress">
          <div class="audio-progress-bar">
            <div class="audio-progress-played"></div>
            <div class="audio-progress-hover"></div>
            <div class="audio-progress-thumb"></div>
          </div>
          <div class="audio-time-tooltip"></div>
        </div>
        
        <div class="audio-time-display">
          <span class="audio-time current">${this.formatTime(this.currentTime)}</span>
          <span class="audio-time total">${this.formatTime(this.duration)}</span>
        </div>
        
        <div class="audio-controls">
          <div class="audio-controls-left">
            <button class="audio-btn" aria-label="Embaralhar" data-action="shuffle">
              <i data-lucide="shuffle" class="w-5 h-5"></i>
            </button>
            <button class="audio-btn" aria-label="Capítulos" data-action="chapters">
              <i data-lucide="list" class="w-5 h-5"></i>
            </button>
          </div>
          
          <div class="audio-controls-center">
            <button class="audio-btn" aria-label="Anterior" data-action="prev">
              <i data-lucide="skip-back" class="w-5 h-5"></i>
            </button>
            <button class="audio-btn seek-btn" aria-label="Voltar 15s" data-action="rewind15">
              <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
              <span class="audio-btn-label">15</span>
            </button>
            <button class="audio-btn play-btn" aria-label="${this.isPlaying ? 'Pausar' : 'Reproduzir'}" data-action="play-pause">
              <i data-lucide="${this.isPlaying ? 'pause' : 'play'}" class="w-8 h-8"></i>
            </button>
            <button class="audio-btn seek-btn" aria-label="Avançar 15s" data-action="forward15">
              <i data-lucide="rotate-cw" class="w-5 h-5"></i>
              <span class="audio-btn-label">15</span>
            </button>
            <button class="audio-btn" aria-label="Próximo" data-action="next">
              <i data-lucide="skip-forward" class="w-5 h-5"></i>
            </button>
          </div>
          
          <div class="audio-controls-right">
            <button class="audio-btn" aria-label="Repetir" data-action="repeat">
              <i data-lucide="repeat" class="w-5 h-5"></i>
            </button>
          </div>
        </div>
        
        <div class="audio-secondary-controls">
          <div class="audio-volume" data-action="volume">
            <button class="audio-btn audio-volume-btn" aria-label="${this.muted ? 'Ativar som' : 'Silenciar'}" data-action="mute">
              <i data-lucide="${this.muted || this.volume === 0 ? 'volume-x' : this.volume < 0.5 ? 'volume-1' : 'volume-2'}" class="w-5 h-5"></i>
            </button>
            <div class="audio-volume-slider-wrapper">
              <input type="range" class="audio-volume-slider" min="0" max="1" step="0.05" value="${this.muted ? 0 : this.volume}" aria-label="Volume">
              <div class="audio-volume-fill"></div>
            </div>
          </div>
          
          <div class="audio-speed">
            <button class="audio-btn audio-speed-btn" aria-label="Velocidade: ${this.playbackRate}x" data-action="speed">
              ${this.playbackRate}x
            </button>
          </div>
          
          <div class="audio-sleep-timer">
            <button class="audio-btn" aria-label="Timer de sono" data-action="sleep-timer">
              <i data-lucide="moon" class="w-5 h-5"></i>
              <span class="audio-sleep-timer-label"></span>
            </button>
          </div>
          
          <button class="audio-btn" aria-label="Mais opções" data-action="more">
            <i data-lucide="more-horizontal" class="w-5 h-5"></i>
          </button>
        </div>
        
        <!-- Chapters panel -->
        <div class="audio-chapters-panel" style="display: none;">
          <div class="audio-chapters-header">
            <h4>Capítulos</h4>
            <button class="audio-btn" data-action="close-chapters">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
          <ul class="audio-chapters-list">
            ${this.renderChaptersList()}
          </ul>
        </div>
        
        <!-- Sleep timer menu -->
        <div class="audio-sleep-menu" style="display: none;">
          <button class="audio-sleep-option" data-minutes="5">5 minutos</button>
          <button class="audio-sleep-option" data-minutes="10">10 minutos</button>
          <button class="audio-sleep-option" data-minutes="15">15 minutos</button>
          <button class="audio-sleep-option" data-minutes="30">30 minutos</button>
          <button class="audio-sleep-option" data-minutes="45">45 minutos</button>
          <button class="audio-sleep-option" data-minutes="60">1 hora</button>
          <button class="audio-sleep-option" data-minutes="90">1.5 horas</button>
          <button class="audio-sleep-option" data-minutes="120">2 horas</button>
          <button class="audio-sleep-option" data-action="cancel-sleep" style="display: none;">Cancelar timer</button>
        </div>
        
        <!-- Speed menu -->
        <div class="audio-speed-menu" style="display: none;">
          ${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(s => `
            <button class="audio-speed-option" data-speed="${s}">
              <span>${s}x</span>
              <i data-lucide="check" class="w-4 h-4" style="display: ${s === this.playbackRate ? 'block' : 'none'}"></i>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.audioElement = this.element.querySelector('.audio-element');
    this.waveformCanvas = this.element.querySelector('.audio-waveform');
    this.waveformCtx = this.waveformCanvas?.getContext('2d');
    
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.initWaveform();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderThumbnail() {
    if (this.thumbnail) {
      return `<img src="${this.thumbnail}" alt="" class="audio-thumbnail" loading="lazy">`;
    }
    return `
      <div class="audio-thumbnail-placeholder">
        <i data-lucide="music" class="w-8 h-8"></i>
      </div>
    `;
  }

  renderChaptersList() {
    if (this.chapters.length === 0) return '<li class="audio-chapter-empty">Nenhum capítulo disponível</li>';
    
    return this.chapters.map((chapter, index) => `
      <li class="audio-chapter-item ${this.currentChapter === index ? 'active' : ''}" data-chapter="${index}">
        <span class="audio-chapter-time">${this.formatTime(chapter.time)}</span>
        <span class="audio-chapter-name">${chapter.title}</span>
      </li>
    `).join('');
  }

  bindEvents() {
    // Audio events
    this.audioElement.addEventListener('loadstart', () => this.onAudioLoadStart());
    this.audioElement.addEventListener('loadedmetadata', () => this.onAudioLoadedMetadata());
    this.audioElement.addEventListener('canplay', () => this.onAudioCanPlay());
    this.audioElement.addEventListener('error', (e) => this.handleError(e));
    this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
    this.audioElement.addEventListener('play', () => this.onAudioPlay());
    this.audioElement.addEventListener('pause', () => this.onAudioPause());
    this.audioElement.addEventListener('ended', () => this.onAudioEnded());
    this.audioElement.addEventListener('volumechange', () => this.updateVolumeUI());
    this.audioElement.addEventListener('ratechange', () => this.updateSpeedUI());

    // Control events (delegated)
    this.element.addEventListener('click', (e) => this.handleClick(e));
    this.element.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.element.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    
    // Global mouse up
    document.addEventListener('mouseup', () => this.handleMouseUp());

    // Keyboard
    this.element.addEventListener('keydown', this.keyboardHandler);

    // Waveform events
    if (this.waveformCanvas) {
      this.waveformCanvas.addEventListener('click', (e) => this.seekFromWaveform(e));
      this.waveformCanvas.addEventListener('mousemove', (e) => this.showWaveformTooltip(e));
      this.waveformCanvas.addEventListener('mouseleave', () => this.hideWaveformTooltip());
    }
  }

  handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'play-pause':
        this.togglePlayPause();
        break;
      case 'rewind15':
        this.seekRelative(-15);
        break;
      case 'forward15':
        this.seekRelative(15);
        break;
      case 'prev':
        this.playPrevious();
        break;
      case 'next':
        this.playNext();
        break;
      case 'mute':
        this.toggleMute();
        break;
      case 'speed':
        this.toggleSpeedMenu();
        break;
      case 'shuffle':
        this.toggleShuffle();
        break;
      case 'repeat':
        this.cycleRepeatMode();
        break;
      case 'chapters':
      case 'toggle-chapters':
        this.toggleChaptersPanel();
        break;
      case 'close-chapters':
        this.closeChaptersPanel();
        break;
      case 'sleep-timer':
        this.toggleSleepMenu();
        break;
      case 'cancel-sleep':
        this.cancelSleepTimer();
        break;
      case 'more':
        this.toggleMoreMenu();
        break;
    }

    // Speed options
    const speedOption = e.target.closest('[data-speed]');
    if (speedOption) {
      this.setPlaybackRate(parseFloat(speedOption.dataset.speed));
      this.closeAllMenus();
    }

    // Sleep timer options
    const sleepOption = e.target.closest('[data-minutes]');
    if (sleepOption) {
      this.setSleepTimer(parseInt(sleepOption.dataset.minutes));
      this.closeAllMenus();
    }

    // Chapter items
    const chapterItem = e.target.closest('[data-chapter]');
    if (chapterItem) {
      this.seekToChapter(parseInt(chapterItem.dataset.chapter));
      this.closeChaptersPanel();
    }
  }

  handleMouseDown(e) {
    const progressWrapper = e.target.closest('[data-action="progress"]');
    if (progressWrapper) {
      this.isDraggingProgress = true;
      this.seekFromEvent(e);
      return;
    }

    const volumeWrapper = e.target.closest('[data-action="volume"]');
    if (volumeWrapper && e.target.closest('.audio-volume-slider, .audio-volume-fill')) {
      this.isDraggingVolume = true;
      this.setVolumeFromEvent(e);
      return;
    }
  }

  handleMouseMove(e) {
    if (this.isDraggingProgress) {
      this.seekFromEvent(e);
      this.showProgressTooltip(e);
    } else if (this.isDraggingVolume) {
      this.setVolumeFromEvent(e);
    } else {
      this.updateProgressHover(e);
    }
  }

  handleMouseUp() {
    if (this.isDraggingProgress) {
      this.isDraggingProgress = false;
      this.hideProgressTooltip();
    }
    if (this.isDraggingVolume) {
      this.isDraggingVolume = false;
    }
  }

  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.seekRelative(e.shiftKey ? -30 : -15);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.seekRelative(e.shiftKey ? 30 : 15);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.setVolume(Math.min(1, this.volume + 0.1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.setVolume(Math.max(0, this.volume - 0.1));
        break;
      case 'm':
        this.toggleMute();
        break;
      case '>':
      case '.':
        this.setPlaybackRate(Math.min(2, this.playbackRate + 0.25));
        break;
      case '<':
      case ',':
        this.setPlaybackRate(Math.max(0.5, this.playbackRate - 0.25));
        break;
      case '0':
        this.seek(0);
        break;
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        this.seek(this.duration * (parseInt(e.key) / 10));
        break;
      case 'Escape':
        this.closeAllMenus();
        break;
    }
  }

  setupKeyboardShortcuts() {
    // Already handled in handleKeyboard
  }

  // Waveform
  initWaveform() {
    if (!this.waveformCanvas || !this.waveformCtx) return;
    
    this.resizeWaveform();
    window.addEventListener('resize', () => this.resizeWaveform());
    
    if (this.waveformData) {
      this.drawWaveform();
    } else {
      this.generateMockWaveform();
    }
  }

  resizeWaveform() {
    if (!this.waveformCanvas) return;
    
    const container = this.waveformCanvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.waveformCanvas.width = rect.width * dpr;
    this.waveformCanvas.height = rect.height * dpr;
    this.waveformCanvas.style.width = `${rect.width}px`;
    this.waveformCanvas.style.height = `${rect.height}px`;
    
    this.waveformCtx.scale(dpr, dpr);
    this.drawWaveform();
  }

  generateMockWaveform() {
    const barCount = 100;
    this.waveformData = new Array(barCount).fill(0).map(() => Math.random() * 0.8 + 0.2);
    this.drawWaveform();
  }

  drawWaveform() {
    if (!this.waveformCtx || !this.waveformData) return;
    
    const ctx = this.waveformCtx;
    const canvas = this.waveformCanvas;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    
    ctx.clearRect(0, 0, width, height);
    
    const barWidth = width / this.waveformData.length;
    const gap = 1;
    const progress = this.duration > 0 ? this.currentTime / this.duration : 0;
    
    this.waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = amplitude * height * 0.8;
      const y = (height - barHeight) / 2;
      
      const isPlayed = index / this.waveformData.length <= progress;
      
      ctx.fillStyle = isPlayed ? 'var(--color-primary)' : 'var(--color-border)';
      ctx.fillRect(x + gap / 2, y, barWidth - gap, barHeight);
    });
  }

  seekFromWaveform(e) {
    const rect = this.waveformCanvas.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.seek(percentage * this.duration);
  }

  showWaveformTooltip(e) {
    const rect = this.waveformCanvas.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percentage * this.duration;
    
    const tooltip = this.element.querySelector('.audio-time-tooltip');
    if (tooltip) {
      tooltip.textContent = this.formatTime(time);
      tooltip.style.left = `${percentage * 100}%`;
      tooltip.style.opacity = '1';
    }
  }

  hideWaveformTooltip() {
    const tooltip = this.element.querySelector('.audio-time-tooltip');
    if (tooltip) tooltip.style.opacity = '0';
  }

  // Audio controls
  play() {
    this.audioElement.play().catch(() => {});
  }

  pause() {
    this.audioElement.pause();
  }

  togglePlayPause() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  seek(time) {
    this.audioElement.currentTime = Math.max(0, Math.min(this.duration, time));
  }

  seekRelative(seconds) {
    this.seek(this.currentTime + seconds);
  }

  seekFromEvent(e) {
    const wrapper = this.element.querySelector('[data-action="progress"]');
    const rect = wrapper.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.seek(percentage * this.duration);
  }

  seekToChapter(chapterIndex) {
    const chapter = this.chapters[chapterIndex];
    if (chapter) {
      this.seek(chapter.time);
    }
  }

  showProgressTooltip(e) {
    const wrapper = this.element.querySelector('[data-action="progress"]');
    const rect = wrapper.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percentage * this.duration;
    
    const tooltip = this.element.querySelector('.audio-time-tooltip');
    const hoverBar = this.element.querySelector('.audio-progress-hover');
    const thumb = this.element.querySelector('.audio-progress-thumb');
    
    if (tooltip) {
      tooltip.textContent = this.formatTime(time);
      tooltip.style.left = `${percentage * 100}%`;
      tooltip.style.opacity = '1';
    }
    if (hoverBar) hoverBar.style.width = `${percentage * 100}%`;
    if (thumb) thumb.style.left = `${percentage * 100}%`;
  }

  hideProgressTooltip() {
    const tooltip = this.element.querySelector('.audio-time-tooltip');
    const hoverBar = this.element.querySelector('.audio-progress-hover');
    const thumb = this.element.querySelector('.audio-progress-thumb');
    
    if (tooltip) tooltip.style.opacity = '0';
    if (hoverBar) hoverBar.style.width = '0';
    if (thumb) thumb.style.left = '0';
  }

  updateProgressHover(e) {
    const wrapper = this.element.querySelector('[data-action="progress"]');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      this.showProgressTooltip(e);
    } else {
      this.hideProgressTooltip();
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = this.volume;
    this.muted = this.volume === 0;
    this.audioElement.muted = this.muted;
  }

  setVolumeFromEvent(e) {
    const slider = this.element.querySelector('.audio-volume-slider');
    const rect = slider.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.setVolume(percentage);
  }

  toggleMute() {
    if (this.muted) {
      this.setVolume(this.lastVolume || 1);
    } else {
      this.lastVolume = this.volume;
      this.setVolume(0);
    }
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.audioElement.playbackRate = rate;
    this.updateSpeedUI();
    this.onRateChange(rate);
  }

  toggleShuffle() {
    const btn = this.element.querySelector('[data-action="shuffle"]');
    if (btn) {
      btn.classList.toggle('active');
    }
  }

  cycleRepeatMode() {
    const btn = this.element.querySelector('[data-action="repeat"]');
    if (btn) {
      const modes = ['none', 'all', 'one'];
      const currentMode = btn.dataset.mode || 'none';
      const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length;
      const nextMode = modes[nextIndex];
      
      btn.dataset.mode = nextMode;
      btn.classList.toggle('active', nextMode !== 'none');
      
      const icon = btn.querySelector('i');
      if (icon) {
        if (nextMode === 'one') {
          icon.setAttribute('data-lucide', 'repeat-1');
        } else {
          icon.setAttribute('data-lucide', 'repeat');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons(btn);
      }
    }
  }

  playPrevious() {
    this.onPrev?.();
  }

  playNext() {
    this.onNext?.();
  }

  // UI Updates
  onAudioLoadStart() {
    this.showLoading(true);
  }

  onAudioLoadedMetadata() {
    this.duration = this.audioElement.duration || 0;
    this.updateDurationUI();
    this.updateChapters();
    this.drawWaveform();
  }

  onAudioCanPlay() {
    this.showLoading(false);
  }

  onAudioPlay() {
    this.isPlaying = true;
    this.updatePlayPauseUI();
    this.onPlay();
    this.startWaveformAnimation();
  }

  onAudioPause() {
    this.isPlaying = false;
    this.updatePlayPauseUI();
    this.onPause();
    this.stopWaveformAnimation();
  }

  onAudioEnded() {
    this.isPlaying = false;
    this.updatePlayPauseUI();
    this.checkSleepTimer();
  }

  updatePlayPauseUI() {
    const playIcon = this.element.querySelector('.play-btn i');
    if (playIcon) {
      playIcon.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
      if (typeof lucide !== 'undefined') lucide.createIcons(playIcon.parentElement);
    }
  }

  updateProgress() {
    this.currentTime = this.audioElement.currentTime;
    const percentage = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
    
    const played = this.element.querySelector('.audio-progress-played');
    const thumb = this.element.querySelector('.audio-progress-thumb');
    const currentTimeEl = this.element.querySelector('.audio-time.current');
    const waveformProgress = this.element.querySelector('.audio-waveform-progress');
    
    if (played && !this.isDraggingProgress) played.style.width = `${percentage}%`;
    if (thumb && !this.isDraggingProgress) thumb.style.left = `${percentage}%`;
    if (currentTimeEl) currentTimeEl.textContent = this.formatTime(this.currentTime);
    if (waveformProgress) waveformProgress.style.width = `${percentage}%`;
    
    this.updateCurrentChapter();
    this.drawWaveform();
    this.onTimeUpdate(this.currentTime, this.duration);
  }

  updateDurationUI() {
    const totalTimeEl = this.element.querySelector('.audio-time.total');
    if (totalTimeEl) totalTimeEl.textContent = this.formatTime(this.duration);
    this.onDurationChange(this.duration);
  }

  updateVolumeUI() {
    this.volume = this.audioElement.volume;
    this.muted = this.audioElement.muted;
    
    const slider = this.element.querySelector('.audio-volume-slider');
    const fill = this.element.querySelector('.audio-volume-fill');
    const volumeIcon = this.element.querySelector('[data-action="mute"] i');
    
    if (slider) slider.value = this.muted ? 0 : this.volume;
    if (fill) fill.style.width = `${(this.muted ? 0 : this.volume) * 100}%`;
    
    if (volumeIcon) {
      const iconName = this.muted || this.volume === 0 ? 'volume-x' : this.volume < 0.5 ? 'volume-1' : 'volume-2';
      volumeIcon.setAttribute('data-lucide', iconName);
      if (typeof lucide !== 'undefined') lucide.createIcons(volumeIcon.parentElement);
    }
    
    const muteBtn = this.element.querySelector('[data-action="mute"]');
    if (muteBtn) muteBtn.setAttribute('aria-label', this.muted ? 'Ativar som' : 'Silenciar');
    
    this.onVolumeChange(this.volume, this.muted);
  }

  updateSpeedUI() {
    this.playbackRate = this.audioElement.playbackRate;
    const speedBtn = this.element.querySelector('[data-action="speed"]');
    if (speedBtn) {
      speedBtn.textContent = `${this.playbackRate}x`;
      speedBtn.setAttribute('aria-label', `Velocidade: ${this.playbackRate}x`);
    }
    
    const checkmarks = this.element.querySelectorAll('.audio-speed-menu .audio-speed-option i');
    checkmarks.forEach((icon) => {
      const item = icon.closest('.audio-speed-option');
      const speed = parseFloat(item.dataset.speed);
      icon.style.display = speed === this.playbackRate ? 'block' : 'none';
    });
  }

  updateChapters() {
    if (this.chapters.length === 0) return;
    
    const chaptersList = this.element.querySelector('.audio-chapters-list');
    if (chaptersList) {
      chaptersList.innerHTML = this.renderChaptersList();
    }
  }

  updateCurrentChapter() {
    if (this.chapters.length === 0) return;
    
    let chapterIndex = -1;
    for (let i = this.chapters.length - 1; i >= 0; i--) {
      if (this.currentTime >= this.chapters[i].time) {
        chapterIndex = i;
        break;
      }
    }
    
    if (chapterIndex !== this.currentChapter) {
      this.currentChapter = chapterIndex;
      
      const chapterName = this.element.querySelector('.audio-chapter-name');
      if (chapterName && chapterIndex >= 0) {
        chapterName.textContent = this.chapters[chapterIndex].title;
      }
      
      const chapterItems = this.element.querySelectorAll('.audio-chapter-item');
      chapterItems.forEach((item, index) => {
        item.classList.toggle('active', index === chapterIndex);
      });
      
      this.onChapterChange(this.chapters[chapterIndex], chapterIndex);
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Waveform animation
  startWaveformAnimation() {
    const animate = () => {
      this.drawWaveform();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  stopWaveformAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Sleep timer
  setSleepTimer(minutes) {
    this.cancelSleepTimer();
    
    this.sleepTimerDuration = minutes * 60 * 1000;
    this.sleepTimerRemaining = this.sleepTimerDuration;
    
    this.sleepTimerInterval = setInterval(() => {
      this.sleepTimerRemaining -= 1000;
      
      if (this.sleepTimerRemaining <= 0) {
        this.cancelSleepTimer();
        this.pause();
        this.onSleepTimerEnd();
      }
      
      this.updateSleepTimerUI();
    }, 1000);
    
    this.updateSleepTimerUI();
    this.closeAllMenus();
  }

  cancelSleepTimer() {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }
    
    this.sleepTimerDuration = null;
    this.sleepTimerRemaining = null;
    
    const label = this.element.querySelector('.audio-sleep-timer-label');
    if (label) label.textContent = '';
    
    const cancelBtn = this.element.querySelector('[data-action="cancel-sleep"]');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  updateSleepTimerUI() {
    const label = this.element.querySelector('.audio-sleep-timer-label');
    const cancelBtn = this.element.querySelector('[data-action="cancel-sleep"]');
    
    if (this.sleepTimerRemaining !== null) {
      const mins = Math.floor(this.sleepTimerRemaining / 60000);
      const secs = Math.floor((this.sleepTimerRemaining % 60000) / 1000);
      if (label) label.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (cancelBtn) cancelBtn.style.display = 'block';
    } else {
      if (label) label.textContent = '';
      if (cancelBtn) cancelBtn.style.display = 'none';
    }
  }

  checkSleepTimer() {
    // Optional: stop after current track if sleep timer is active
  }

  // Menus
  toggleSpeedMenu() {
    const menu = this.element.querySelector('.audio-speed-menu');
    if (menu) {
      const isOpen = menu.style.display !== 'none';
      this.closeAllMenus();
      menu.style.display = isOpen ? 'none' : 'flex';
    }
  }

  toggleSleepMenu() {
    const menu = this.element.querySelector('.audio-sleep-menu');
    if (menu) {
      const isOpen = menu.style.display !== 'none';
      this.closeAllMenus();
      menu.style.display = isOpen ? 'none' : 'flex';
    }
  }

  toggleChaptersPanel() {
    const panel = this.element.querySelector('.audio-chapters-panel');
    if (panel) {
      const isOpen = panel.style.display !== 'none';
      this.closeAllMenus();
      panel.style.display = isOpen ? 'none' : 'block';
    }
  }

  closeChaptersPanel() {
    const panel = this.element.querySelector('.audio-chapters-panel');
    if (panel) panel.style.display = 'none';
  }

  toggleMoreMenu() {
    // Placeholder for more options menu
  }

  closeAllMenus() {
    this.element.querySelectorAll('.audio-speed-menu, .audio-sleep-menu, .audio-chapters-panel').forEach(m => {
      m.style.display = 'none';
    });
  }

  showLoading(show) {
    const loading = this.element.querySelector('.audio-loading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
  }

  handleError(e) {
    this.showLoading(false);
    this.onError?.(e);
  }

  // Public API
  setSrc(src) {
    this.src = src;
    this.audioElement.src = src;
    this.audioElement.load();
  }

  setTrack(track) {
    this.src = track.src;
    this.title = track.title;
    this.artist = track.artist;
    this.album = track.album;
    this.thumbnail = track.thumbnail;
    this.chapters = track.chapters || [];
    
    this.audioElement.src = track.src;
    this.audioElement.load();
    
    // Update UI
    const titleEl = this.element.querySelector('.audio-title');
    const artistEl = this.element.querySelector('.audio-artist');
    const albumEl = this.element.querySelector('.audio-album');
    
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = track.artist;
    if (albumEl) {
      if (track.album) {
        albumEl.textContent = track.album;
        albumEl.style.display = 'block';
      } else {
        albumEl.style.display = 'none';
      }
    }
    
    this.updateChapters();
  }

  setChapters(chapters) {
    this.chapters = chapters;
    this.updateChapters();
  }

  destroy() {
    this.stopWaveformAnimation();
    this.cancelSleepTimer();
    document.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.resizeWaveform);
    this.element.removeEventListener('keydown', this.keyboardHandler);
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
