// src/components/VideoPlayer.js
export class VideoPlayer {
  constructor(options = {}) {
    this.src = options.src ?? null;
    this.poster = options.poster ?? null;
    this.title = options.title ?? '';
    this.description = options.description ?? '';
    this.duration = options.duration ?? 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.volume = 1;
    this.muted = false;
    this.playbackRate = 1;
    this.isFullscreen = false;
    this.isPictureInPicture = false;
    this.showControls = true;
    this.controlsTimeout = null;
    this.quality = options.quality ?? 'auto';
    this.availableQualities = options.availableQualities ?? ['auto', '1080p', '720p', '480p', '360p'];
    this.subtitles = options.subtitles ?? [];
    this.currentSubtitle = options.currentSubtitle ?? null;
    this.breakpoints = options.breakpoints ?? [];
    this.activeBreakpoint = null;
    
    // Callbacks
    this.onPlay = options.onPlay ?? (() => {});
    this.onPause = options.onPause ?? (() => {});
    this.onTimeUpdate = options.onTimeUpdate ?? (() => {});
    this.onDurationChange = options.onDurationChange ?? (() => {});
    this.onVolumeChange = options.onVolumeChange ?? (() => {});
    this.onRateChange = options.onRateChange ?? (() => {});
    this.onFullscreenChange = options.onFullscreenChange ?? (() => {});
    this.onError = options.onError ?? (() => {});
    this.onQualityChange = options.onQualityChange ?? (() => {});
    this.onSubtitleChange = options.onSubtitleChange ?? (() => {});
    
    this.element = null;
    this.videoElement = null;
    this.isDraggingProgress = false;
    this.isDraggingVolume = false;
    this.lastVolume = 1;
    this.keyboardHandler = this.handleKeyboard.bind(this);
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'video-player';
    this.element.tabIndex = 0;
    
    this.element.innerHTML = `
      <div class="video-container">
        <video 
          class="video-element"
          ${this.poster ? `poster="${this.poster}"` : ''}
          playsinline
          crossorigin="anonymous"
        >
          ${this.src ? `<source src="${this.src}" type="video/mp4">` : ''}
          ${this.subtitles.map(sub => `
            <track kind="subtitles" src="${sub.src}" srclang="${sub.lang}" label="${sub.label}" ${sub.default ? 'default' : ''}>
          `).join('')}
        </video>
        
        <div class="video-loading" aria-hidden="true">
          <div class="spinner"></div>
        </div>
        
        <div class="video-error" style="display: none;" aria-live="polite">
          <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-4 text-error"></i>
          <p class="text-center text-secondary">Erro ao carregar o vídeo</p>
          <button class="btn btn-primary mt-4" data-action="retry">Tentar novamente</button>
        </div>
        
        <div class="video-overlay" aria-hidden="true">
          <button class="video-big-play" aria-label="Reproduzir" data-action="play">
            <i data-lucide="play" class="w-12 h-12"></i>
          </button>
        </div>
        
        <div class="video-quiz-overlay" style="display: none;"></div>
        
        <div class="video-controls" data-hidden="true">
          <div class="video-progress-wrapper" data-action="progress">
            <div class="video-progress-bar">
              <div class="video-progress-buffer"></div>
              <div class="video-progress-played"></div>
              <div class="video-progress-hover"></div>
              <div class="video-progress-thumb"></div>
            </div>
            <div class="video-time-tooltip"></div>
          </div>
          
          <div class="video-controls-main">
            <div class="video-controls-left">
              <button class="video-btn" aria-label="Reproduzir/Pausar" data-action="play-pause">
                <i data-lucide="play" class="w-5 h-5 play-icon"></i>
                <i data-lucide="pause" class="w-5 h-5 pause-icon" style="display:none"></i>
              </button>
              <button class="video-btn" aria-label="Voltar 10s" data-action="rewind10">
                <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
                <span class="video-btn-label">10s</span>
              </button>
              <button class="video-btn" aria-label="Avançar 10s" data-action="forward10">
                <span class="video-btn-label">10s</span>
                <i data-lucide="rotate-cw" class="w-5 h-5"></i>
              </button>
            </div>
            
            <div class="video-controls-center">
              <span class="video-time video-time-current">0:00</span>
              <span class="video-time-separator">/</span>
              <span class="video-time video-time-total">0:00</span>
            </div>
            
            <div class="video-controls-right">
              <div class="video-volume" data-action="volume">
                <button class="video-btn video-volume-btn" aria-label="Silenciar" data-action="mute">
                  <i data-lucide="volume-2" class="w-5 h-5 volume-high"></i>
                  <i data-lucide="volume-1" class="w-5 h-5 volume-low" style="display:none"></i>
                  <i data-lucide="volume-x" class="w-5 h-5 volume-muted" style="display:none"></i>
                </button>
                <div class="video-volume-slider-wrapper">
                  <input type="range" class="video-volume-slider" min="0" max="1" step="0.05" value="1" aria-label="Volume">
                  <div class="video-volume-fill"></div>
                </div>
              </div>
              
              <div class="video-settings">
                <button class="video-btn" aria-label="Criar Corte/Anotação" data-action="clip" style="color: var(--orange-500);">
                  <i data-lucide="scissors" class="w-5 h-5"></i>
                </button>
                <button class="video-btn" aria-label="Legendas" data-action="subtitles">
                  <i data-lucide="message-square" class="w-5 h-5"></i>
                </button>
                <button class="video-btn" aria-label="Qualidade" data-action="quality">
                  <i data-lucide="settings" class="w-5 h-5"></i>
                </button>
                <button class="video-btn" aria-label="Velocidade" data-action="speed">
                  <i data-lucide="clock" class="w-5 h-5"></i>
                </button>
                <button class="video-btn" aria-label="Picture in Picture" data-action="pip">
                  <i data-lucide="pip" class="w-5 h-5"></i>
                </button>
                <button class="video-btn" aria-label="Tela cheia" data-action="fullscreen">
                  <i data-lucide="maximize" class="w-5 h-5 fullscreen-enter"></i>
                  <i data-lucide="minimize" class="w-5 h-5 fullscreen-exit" style="display:none"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Subtitles menu -->
        <div class="video-menu video-subtitles-menu" role="menu" style="display:none">
          <button class="video-menu-item" role="menuitem" data-subtitle="off">
            <span>Desativadas</span>
            <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
          </button>
          ${this.subtitles.map(sub => `
            <button class="video-menu-item" role="menuitem" data-subtitle="${sub.lang}">
              <span>${sub.label}</span>
              <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
            </button>
          `).join('')}
        </div>
        
        <!-- Quality menu -->
        <div class="video-menu video-quality-menu" role="menu" style="display:none">
          ${this.availableQualities.map(q => `
            <button class="video-menu-item" role="menuitem" data-quality="${q}">
              <span>${q}</span>
              <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
            </button>
          `).join('')}
        </div>
        
        <!-- Speed menu -->
        <div class="video-menu video-speed-menu" role="menu" style="display:none">
          ${[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(s => `
            <button class="video-menu-item" role="menuitem" data-speed="${s}">
              <span>${s}x</span>
              <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.videoElement = this.element.querySelector('.video-element');
    this.bindEvents();
    this.setupKeyboardShortcuts();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  bindEvents() {
    // Video events
    this.videoElement.addEventListener('loadstart', () => this.showLoading(true));
    this.videoElement.addEventListener('loadeddata', () => this.showLoading(false));
    this.videoElement.addEventListener('canplay', () => this.showLoading(false));
    this.videoElement.addEventListener('error', (e) => this.handleError(e));
    this.videoElement.addEventListener('timeupdate', () => this.updateProgress());
    this.videoElement.addEventListener('durationchange', () => this.updateDuration());
    this.videoElement.addEventListener('play', () => this.onVideoPlay());
    this.videoElement.addEventListener('pause', () => this.onVideoPause());
    this.videoElement.addEventListener('volumechange', () => this.updateVolumeUI());
    this.videoElement.addEventListener('ratechange', () => this.updateSpeedUI());
    this.videoElement.addEventListener('progress', () => this.updateBuffer());
    this.videoElement.addEventListener('ended', () => this.onVideoEnded());
    this.videoElement.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    this.videoElement.addEventListener('enterpictureinpicture', () => this.onPiPEnter());
    this.videoElement.addEventListener('leavepictureinpicture', () => this.onPiPLeave());

    // Control events (delegated)
    this.element.addEventListener('click', (e) => this.handleClick(e));
    this.element.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.element.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    
    // Global mouse up
    document.addEventListener('mouseup', () => this.handleMouseUp());
    
    // Touch events
    this.element.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    this.element.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.element.addEventListener('touchend', () => this.handleTouchEnd());

    // Keyboard
    this.element.addEventListener('keydown', this.keyboardHandler);

    // Mouse enter/leave for controls
    this.element.addEventListener('mouseenter', () => this.showControls());
    this.element.addEventListener('mouseleave', () => this.hideControlsDelayed());
    
    // Focus for keyboard
    this.element.addEventListener('focus', () => this.showControls());
    this.element.addEventListener('blur', () => this.hideControlsDelayed());
  }

  handleClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'play':
      case 'play-pause':
        this.togglePlayPause();
        break;
      case 'clip':
        this.createClip();
        break;
      case 'rewind10':
        this.seekRelative(-10);
        break;
      case 'forward10':
        this.seekRelative(10);
        break;
      case 'mute':
        this.toggleMute();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      case 'pip':
        this.togglePictureInPicture();
        break;
      case 'speed':
        this.toggleSpeedMenu(e.target.closest('[data-action="speed"]'));
        break;
      case 'quality':
        this.toggleQualityMenu(e.target.closest('[data-action="quality"]'));
        break;
      case 'subtitles':
        this.toggleSubtitlesMenu(e.target.closest('[data-action="subtitles"]'));
        break;
      case 'retry':
        this.retry();
        break;
    }

    // Menu items
    const menuItem = e.target.closest('[data-speed], [data-quality], [data-subtitle]');
    if (menuItem) {
      if (menuItem.dataset.speed) this.setPlaybackRate(parseFloat(menuItem.dataset.speed));
      if (menuItem.dataset.quality) this.setQuality(menuItem.dataset.quality);
      if (menuItem.dataset.subtitle) this.setSubtitle(menuItem.dataset.subtitle);
      this.closeAllMenus();
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
    if (volumeWrapper && e.target.closest('.video-volume-slider, .video-volume-fill')) {
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

  handleTouchStart(e) {
    const touch = e.touches[0];
    const progressWrapper = e.target.closest('[data-action="progress"]');
    if (progressWrapper) {
      this.isDraggingProgress = true;
      this.seekFromEvent({ clientX: touch.clientX, clientY: touch.clientY, target: progressWrapper });
      return;
    }
    this.handleClick(e);
  }

  handleTouchMove(e) {
    if (this.isDraggingProgress) {
      e.preventDefault();
      const touch = e.touches[0];
      this.seekFromEvent({ clientX: touch.clientX, clientY: touch.clientY });
      this.showProgressTooltip({ clientX: touch.clientX, clientY: touch.clientY });
    }
  }

  handleTouchEnd() {
    if (this.isDraggingProgress) {
      this.isDraggingProgress = false;
      this.hideProgressTooltip();
    }
  }

  handleKeyboard(e) {
    // Don't handle if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.seekRelative(e.shiftKey ? -30 : -10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.seekRelative(e.shiftKey ? 30 : 10);
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
      case 'f':
        this.toggleFullscreen();
        break;
      case 'p':
        this.togglePictureInPicture();
        break;
      case '>':
      case '.':
        this.setPlaybackRate(Math.min(2, this.playbackRate + 0.25));
        break;
      case '<':
      case ',':
        this.setPlaybackRate(Math.max(0.25, this.playbackRate - 0.25));
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
        if (this.isFullscreen) this.exitFullscreen();
        this.closeAllMenus();
        break;
      case 'c':
        this.toggleSubtitles();
        break;
    }
  }

  setupKeyboardShortcuts() {
    // Already handled in handleKeyboard
  }

  // Video controls
  play() {
    if (this.activeBreakpoint) return;
    this.videoElement.play().catch(() => {});
  }

  pause() {
    this.videoElement.pause();
  }

  togglePlayPause() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  seek(time) {
    const skippedBp = this.breakpoints.find(bp => !bp.resolved && time > bp.time && this.currentTime < bp.time);
    if (skippedBp) {
      time = skippedBp.time;
    }
    this.videoElement.currentTime = Math.max(0, Math.min(this.duration, time));
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

  showProgressTooltip(e) {
    const wrapper = this.element.querySelector('[data-action="progress"]');
    const rect = wrapper.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percentage * this.duration;
    
    const tooltip = this.element.querySelector('.video-time-tooltip');
    const hoverBar = this.element.querySelector('.video-progress-hover');
    const thumb = this.element.querySelector('.video-progress-thumb');
    
    if (tooltip) {
      tooltip.textContent = this.formatTime(time);
      tooltip.style.left = `${percentage * 100}%`;
      tooltip.style.opacity = '1';
    }
    if (hoverBar) hoverBar.style.width = `${percentage * 100}%`;
    if (thumb) thumb.style.left = `${percentage * 100}%`;
  }

  hideProgressTooltip() {
    const tooltip = this.element.querySelector('.video-time-tooltip');
    const hoverBar = this.element.querySelector('.video-progress-hover');
    const thumb = this.element.querySelector('.video-progress-thumb');
    
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
    this.videoElement.volume = this.volume;
    this.muted = this.volume === 0;
    this.videoElement.muted = this.muted;
  }

  setVolumeFromEvent(e) {
    const wrapper = this.element.querySelector('[data-action="volume"]');
    const slider = this.element.querySelector('.video-volume-slider');
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
    this.videoElement.playbackRate = rate;
    this.updateSpeedUI();
    this.onRateChange(rate);
  }

  setQuality(quality) {
    this.quality = quality;
    // In real implementation, would switch video source
    this.onQualityChange(quality);
    this.closeAllMenus();
  }

  setSubtitle(lang) {
    this.currentSubtitle = lang === 'off' ? null : lang;
    const tracks = this.videoElement.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = tracks[i].language === lang ? 'showing' : 'disabled';
    }
    this.onSubtitleChange(this.currentSubtitle);
    this.closeAllMenus();
  }

  toggleSubtitles() {
    const tracks = this.videoElement.textTracks;
    const hasActive = Array.from(tracks).some(t => t.mode === 'showing');
    if (hasActive) {
      this.setSubtitle('off');
    } else if (tracks.length > 0) {
      this.setSubtitle(tracks[0].language);
    }
  }

  // UI Updates
  onVideoPlay() {
    this.isPlaying = true;
    this.updatePlayPauseUI();
    this.hideOverlay();
    this.onPlay();
  }

  onVideoPause() {
    this.isPlaying = false;
    this.updatePlayPauseUI();
    this.showOverlay();
    this.onPause();
  }

  onVideoEnded() {
    this.isPlaying = false;
    this.updatePlayPauseUI();
    this.showOverlay();
  }

  updatePlayPauseUI() {
    const playIcon = this.element.querySelector('.play-icon');
    const pauseIcon = this.element.querySelector('.pause-icon');
    const bigPlay = this.element.querySelector('.video-big-play i');
    
    if (playIcon && pauseIcon) {
      playIcon.style.display = this.isPlaying ? 'none' : 'block';
      pauseIcon.style.display = this.isPlaying ? 'block' : 'none';
    }
    if (bigPlay) {
      bigPlay.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  updateProgress() {
    this.currentTime = this.videoElement.currentTime;
    
    // Check breakpoints
    const activeBp = this.breakpoints.find(bp => !bp.resolved && this.currentTime >= bp.time);
    if (activeBp && !this.activeBreakpoint) {
      this.activeBreakpoint = activeBp;
      this.pause();
      this.showQuiz(activeBp);
    }
    
    const percentage = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
    
    const played = this.element.querySelector('.video-progress-played');
    const thumb = this.element.querySelector('.video-progress-thumb');
    const currentTime = this.element.querySelector('.video-time-current');
    
    if (played && !this.isDraggingProgress) played.style.width = `${percentage}%`;
    if (thumb && !this.isDraggingProgress) thumb.style.left = `${percentage}%`;
    if (currentTime) currentTime.textContent = this.formatTime(this.currentTime);
    
    this.onTimeUpdate(this.currentTime, this.duration);
  }

  updateBuffer() {
    const buffered = this.videoElement.buffered;
    const bufferBar = this.element.querySelector('.video-progress-buffer');
    if (buffered.length > 0 && bufferBar) {
      const percentage = (buffered.end(buffered.length - 1) / this.duration) * 100;
      bufferBar.style.width = `${percentage}%`;
    }
  }

  showQuiz(breakpoint) {
    const overlay = this.element.querySelector('.video-quiz-overlay');
    if (!overlay) return;
    
    overlay.style.display = 'flex';
    this.hideControls();
    
    overlay.innerHTML = `
      <div class="video-quiz-container">
        <h3>Desafio Rápido!</h3>
        <p class="quiz-question">${breakpoint.question}</p>
        <div class="quiz-options">
          ${breakpoint.options.map((opt, i) => `
            <button class="quiz-option-btn" data-index="${i}">${opt}</button>
          `).join('')}
        </div>
        <div class="quiz-feedback" style="display: none;"></div>
      </div>
    `;
    
    const btns = overlay.querySelectorAll('.quiz-option-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const feedback = overlay.querySelector('.quiz-feedback');
        
        // Reset all classes
        btns.forEach(b => { b.classList.remove('correct', 'wrong'); b.disabled = true; });
        
        if (index === breakpoint.answer) {
          e.target.classList.add('correct');
          feedback.textContent = 'Resposta correta! Continuando o vídeo...';
          feedback.style.color = 'var(--success)';
          feedback.style.display = 'block';
          
          setTimeout(() => {
            breakpoint.resolved = true;
            this.activeBreakpoint = null;
            this.hideQuiz();
            this.renderBreakpoints();
            this.play();
          }, 1500);
        } else {
          e.target.classList.add('wrong');
          // Highlight correct answer
          btns[breakpoint.answer].classList.add('correct');
          feedback.textContent = 'Ops, a resposta certa era a verde! Continuando...';
          feedback.style.color = 'var(--error)';
          feedback.style.display = 'block';
          
          setTimeout(() => {
            breakpoint.resolved = true;
            this.activeBreakpoint = null;
            this.hideQuiz();
            this.renderBreakpoints();
            this.play();
          }, 2500);
        }
      });
    });
  }

  hideQuiz() {
    const overlay = this.element.querySelector('.video-quiz-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  updateDuration() {
    this.duration = this.videoElement.duration || 0;
    const totalTime = this.element.querySelector('.video-time-total');
    if (totalTime) totalTime.textContent = this.formatTime(this.duration);
    this.renderBreakpoints();
    this.onDurationChange(this.duration);
  }

  renderBreakpoints() {
    const bar = this.element.querySelector('.video-progress-bar');
    if (!bar) return;
    
    bar.querySelectorAll('.video-progress-marker').forEach(m => m.remove());
    if (this.duration <= 0) return;
    
    this.breakpoints.forEach(bp => {
      const marker = document.createElement('div');
      marker.className = 'video-progress-marker';
      marker.style.left = `${(bp.time / this.duration) * 100}%`;
      if (bp.resolved) marker.classList.add('resolved');
      bar.appendChild(marker);
    });
  }

  updateVolumeUI() {
    this.volume = this.videoElement.volume;
    this.muted = this.videoElement.muted;
    
    const slider = this.element.querySelector('.video-volume-slider');
    const fill = this.element.querySelector('.video-volume-fill');
    const highIcon = this.element.querySelector('.volume-high');
    const lowIcon = this.element.querySelector('.volume-low');
    const mutedIcon = this.element.querySelector('.volume-muted');
    const volumeBtn = this.element.querySelector('.video-volume-btn');
    
    if (slider) slider.value = this.muted ? 0 : this.volume;
    if (fill) fill.style.width = `${(this.muted ? 0 : this.volume) * 100}%`;
    
    if (highIcon && lowIcon && mutedIcon) {
      highIcon.style.display = 'none';
      lowIcon.style.display = 'none';
      mutedIcon.style.display = 'none';
      
      if (this.muted || this.volume === 0) {
        mutedIcon.style.display = 'block';
      } else if (this.volume < 0.5) {
        lowIcon.style.display = 'block';
      } else {
        highIcon.style.display = 'block';
      }
    }
    
    if (volumeBtn) {
      volumeBtn.setAttribute('aria-label', this.muted ? 'Ativar som' : 'Silenciar');
    }
    
    this.onVolumeChange(this.volume, this.muted);
  }

  updateSpeedUI() {
    this.playbackRate = this.videoElement.playbackRate;
    const speedBtn = this.element.querySelector('[data-action="speed"]');
    if (speedBtn) {
      const checkmarks = this.element.querySelectorAll('.video-speed-menu .video-menu-item i');
      checkmarks.forEach((icon, i) => {
        const item = icon.closest('.video-menu-item');
        const speed = parseFloat(item.dataset.speed);
        icon.style.display = speed === this.playbackRate ? 'block' : 'none';
      });
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

  // Menus
  toggleSpeedMenu(trigger) {
    this.closeAllMenus();
    const menu = this.element.querySelector('.video-speed-menu');
    if (menu && trigger) {
      const rect = trigger.getBoundingClientRect();
      const playerRect = this.element.querySelector('.video-container').getBoundingClientRect();
      menu.style.display = 'flex';
      menu.style.left = `${rect.left - playerRect.left}px`;
      menu.style.bottom = `${playerRect.bottom - rect.top + 8}px`;
    }
  }

  toggleQualityMenu(trigger) {
    this.closeAllMenus();
    const menu = this.element.querySelector('.video-quality-menu');
    if (menu && trigger) {
      const rect = trigger.getBoundingClientRect();
      const playerRect = this.element.querySelector('.video-container').getBoundingClientRect();
      menu.style.display = 'flex';
      menu.style.left = `${rect.left - playerRect.left}px`;
      menu.style.bottom = `${playerRect.bottom - rect.top + 8}px`;
    }
  }

  toggleSubtitlesMenu(trigger) {
    this.closeAllMenus();
    const menu = this.element.querySelector('.video-subtitles-menu');
    if (menu && trigger) {
      const rect = trigger.getBoundingClientRect();
      const playerRect = this.element.querySelector('.video-container').getBoundingClientRect();
      menu.style.display = 'flex';
      menu.style.left = `${rect.left - playerRect.left}px`;
      menu.style.bottom = `${playerRect.bottom - rect.top + 8}px`;
    }
  }

  closeAllMenus() {
    this.element.querySelectorAll('.video-menu').forEach(m => m.style.display = 'none');
  }

  // Fullscreen
  toggleFullscreen() {
    if (this.isFullscreen) this.exitFullscreen();
    else this.enterFullscreen();
  }

  enterFullscreen() {
    const container = this.element.querySelector('.video-container');
    if (container.requestFullscreen) {
      container.requestFullscreen();
    }
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  onFullscreenChange() {
    this.isFullscreen = document.fullscreenElement === this.element.querySelector('.video-container');
    const enterIcon = this.element.querySelector('.fullscreen-enter');
    const exitIcon = this.element.querySelector('.fullscreen-exit');
    if (enterIcon && exitIcon) {
      enterIcon.style.display = this.isFullscreen ? 'none' : 'block';
      exitIcon.style.display = this.isFullscreen ? 'block' : 'none';
    }
    this.onFullscreenChange(this.isFullscreen);
  }

  // Picture in Picture
  async togglePictureInPicture() {
    if (this.isPictureInPicture) {
      await document.exitPictureInPicture();
    } else {
      try {
        await this.videoElement.requestPictureInPicture();
      } catch (e) {
        console.warn('PiP not available', e);
      }
    }
  }

  onPiPEnter() {
    this.isPictureInPicture = true;
  }

  onPiPLeave() {
    this.isPictureInPicture = false;
  }

  // Controls visibility
  showControls() {
    const controls = this.element.querySelector('.video-controls');
    if (controls) {
      controls.removeAttribute('data-hidden');
    }
    this.clearControlsTimeout();
  }

  hideControls() {
    const controls = this.element.querySelector('.video-controls');
    if (controls) {
      controls.setAttribute('data-hidden', 'true');
    }
  }

  hideControlsDelayed() {
    this.clearControlsTimeout();
    this.controlsTimeout = setTimeout(() => {
      if (!this.isDraggingProgress && !this.isDraggingVolume) {
        this.hideControls();
        this.closeAllMenus();
      }
    }, 3000);
  }

  clearControlsTimeout() {
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = null;
    }
  }

  showOverlay() {
    const overlay = this.element.querySelector('.video-overlay');
    if (overlay && !this.isPlaying) overlay.style.display = 'flex';
  }

  hideOverlay() {
    const overlay = this.element.querySelector('.video-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  showLoading(show) {
    const loading = this.element.querySelector('.video-loading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
  }

  handleError(e) {
    this.showLoading(false);
    const error = this.element.querySelector('.video-error');
    if (error) error.style.display = 'flex';
    this.onError(e);
  }

  retry() {
    const error = this.element.querySelector('.video-error');
    if (error) error.style.display = 'none';
    this.videoElement.load();
    this.showLoading(true);
  }

  // Public API
  setSrc(src, poster = null) {
    this.src = src;
    this.poster = poster;
    this.videoElement.src = src;
    if (poster) this.videoElement.poster = poster;
    this.videoElement.load();
  }

  setTitle(title) {
    this.title = title;
  }

  setBreakpoints(breakpoints) {
    this.breakpoints = breakpoints ?? [];
    this.activeBreakpoint = null;
    this.hideQuiz();
    this.renderBreakpoints();
  }

  setSubtitles(subtitles) {
    this.subtitles = subtitles ?? [];
    
    // Clear existing tracks
    const existingTracks = this.videoElement.querySelectorAll('track');
    existingTracks.forEach(t => t.remove());
    
    // Add new tracks
    this.subtitles.forEach(sub => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = sub.src;
      track.srclang = sub.lang;
      track.label = sub.label;
      if (sub.default) track.default = true;
      this.videoElement.appendChild(track);
    });

    // Update subtitles menu UI
    const subtitlesMenu = this.element.querySelector('.video-subtitles-menu');
    if (subtitlesMenu) {
      subtitlesMenu.innerHTML = \`
        <button class="video-menu-item" role="menuitem" data-subtitle="off">
          <span>Desativadas</span>
          <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
        </button>
        \${this.subtitles.map(sub => \`
          <button class="video-menu-item" role="menuitem" data-subtitle="\${sub.lang}">
            <span>\${sub.label}</span>
            <i data-lucide="check" class="w-4 h-4" style="display:none"></i>
          </button>
        \`).join('')}
      \`;
      if (typeof lucide !== 'undefined') lucide.createIcons(subtitlesMenu);
    }
  }

  createClip() {
    let text = '';
    const tracks = this.videoElement.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].mode === 'showing' || tracks[i].mode === 'hidden') {
        const activeCues = tracks[i].activeCues;
        if (activeCues && activeCues.length > 0) {
          text = Array.from(activeCues).map(cue => cue.text).join(' ');
          break;
        }
      }
    }
    
    this.breakpoints.push({
      time: this.currentTime,
      type: 'clip',
      resolved: true
    });
    this.renderBreakpoints();
    
    window.dispatchEvent(new CustomEvent('video-clip-created', {
      detail: {
        time: this.currentTime,
        text: text,
        title: this.title
      }
    }));
  }

  destroy() {
    this.clearControlsTimeout();
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('keydown', this.keyboardHandler);
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

