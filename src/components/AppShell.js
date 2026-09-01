import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { MiniPlayer } from './MiniPlayer.js';
import { triggerConfetti } from '../utils/confetti.js';
import { api } from '../utils/api.js';

export class AppShell {
  constructor(options = {}) {
    this.sidebarCollapsed = false;
    this.sidebarMobileOpen = false;
    this.miniPlayerHidden = false;
    this.currentRoute = 'dashboard';
    if (!options.user?.id) throw new Error('Authenticated user is required.');
    this.user = options.user;
    this.onLogout = options.onLogout ?? (() => {});
    this.subjects = options.subjects ?? [];
    this.libraryService = options.libraryService ?? null;
    this.pendingLocalResource = null;
    
    this.sidebar = new Sidebar({
      collapsed: this.sidebarCollapsed,
      currentRoute: this.currentRoute,
      user: this.user,
      subjects: this.subjects,
      onNavigate: (route) => this.navigate(route),
      onToggleCollapse: (collapsed) => this.setSidebarCollapsed(collapsed)
    });
    
    this.header = new Header({
      user: this.user,
      onSearch: (query, callback) => this.handleSearch(query, callback),
      onThemeToggle: () => this.toggleTheme(),
      onUserMenuAction: (action) => this.handleUserMenuAction(action),
      onCommandPalette: (action) => this.handleCommandAction(action),
      onPomodoroComplete: (mode) => this.handlePomodoroComplete(mode)
    });
    
    this.miniPlayer = new MiniPlayer({
      onPlay: () => this.handlePlayerPlay(),
      onPause: () => this.handlePlayerPause(),
      onSeek: (time) => this.handlePlayerSeek(time),
      onVolumeChange: (vol) => this.handleVolumeChange(vol),
      onMuteToggle: (muted) => this.handleMuteToggle(muted),
      onRateChange: (rate) => this.handleRateChange(rate),
      onNext: () => this.handlePlayerNext(),
      onPrev: () => this.handlePlayerPrev(),
      onFullscreen: () => this.handleFullscreen(),
      onExpand: (expanded) => this.handlePlayerExpand(expanded)
    });
    
    this.element = null;
    this.contentElement = null;
    this.routes = new Map();
    this.commandPalette = null;
    this.activeRouteComponent = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'app-shell';
    this.element.innerHTML = `
      <div class="app-sidebar-container"></div>
      <div class="app-main">
        <div class="app-header-container"></div>
        <main class="app-content" role="main"></main>
      </div>
      <div class="mini-player-container"></div>
    `;

    // Mount components
    const sidebarContainer = this.element.querySelector('.app-sidebar-container');
    const headerContainer = this.element.querySelector('.app-header-container');
    const miniPlayerContainer = this.element.querySelector('.mini-player-container');
    this.contentElement = this.element.querySelector('.app-content');

    sidebarContainer.appendChild(this.sidebar.render());
    headerContainer.appendChild(this.header.render());
    miniPlayerContainer.appendChild(this.miniPlayer.render());

    // Listen for header events
    this.element.addEventListener('header:toggle-menu', () => this.toggleMobileSidebar());

    // Keyboard shortcuts for sidebar toggle (Ctrl+B)
    this.setupGlobalShortcuts();

    if (typeof lucide !== 'undefined') lucide.createIcons();

    return this.element;
  }

  setupGlobalShortcuts() {
    // These are handled by the global keyboard system in main.js
    // But we can listen for custom events
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });
  }

  // Navigation
  registerRoute(path, component) {
    this.routes.set(path, component);
  }

  start(route = 'dashboard') {
    const initialRoute = this.routes.has(route) ? route : 'dashboard';
    this.currentRoute = initialRoute;
    this.sidebar.setActiveRoute(initialRoute);
    return this.renderRoute(initialRoute);
  }

  navigate(route) {
    this.currentRoute = route;
    this.sidebar.setActiveRoute(route);
    this.renderRoute(route);
    
    // Close mobile sidebar on navigation
    if (this.sidebarMobileOpen) this.closeMobileSidebar();
    
    // Update URL without reload (for future router)
    window.history.pushState({ route }, '', `#${route}`);
  }

  async renderRoute(route) {
    this.activeRouteComponent?.destroy?.();
    this.activeRouteComponent = null;
    // Show loading
    this.contentElement.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    `;

    const Component = this.routes.get(route);
    if (Component) {
      try {
        const component = new Component({ 
          app: this,
          user: this.user,
          subjects: this.subjects,
          library: this.libraryService
        });
        
        // Render could be sync or async
        const renderedElement = await component.render();
        
        this.contentElement.innerHTML = '';
        this.contentElement.appendChild(renderedElement);
        this.activeRouteComponent = component;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch (error) {
        console.error('Error rendering route:', error);
        this.contentElement.innerHTML = `
          <div class="text-center py-12">
            <i data-lucide="alert-circle" class="w-12 h-12 mx-auto text-error mb-4"></i>
            <h2 class="text-xl font-semibold mb-2">Erro ao carregar</h2>
            <p class="text-secondary">${error.message}</p>
          </div>
        `;
      }
    } else {
      // Default fallback
      this.contentElement.innerHTML = `
        <div class="text-center py-12">
          <i data-lucide="layout-dashboard" class="w-16 h-16 mx-auto text-muted mb-4"></i>
          <h1 class="text-2xl font-display font-semibold mb-2">${this.getRouteTitle(route)}</h1>
          <p class="text-secondary">Componente em desenvolvimento</p>
        </div>
      `;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  getRouteTitle(route) {
    const titles = {
      dashboard: 'Dashboard',
      study: 'Estudar',
      review: 'Revisão',
      video: 'Videoaulas',
      audio: 'Áudios',
      pdf: 'PDFs',
      flashcards: 'Flashcards',
      notes: 'Anotações',
      exams: 'Simulados',
      stats: 'Estatísticas',
      library: 'Arquivos Locais'
    };
    return titles[route] || route.charAt(0).toUpperCase() + route.slice(1);
  }

  // Sidebar controls
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.setSidebarCollapsed(this.sidebarCollapsed);
  }

  setSidebarCollapsed(collapsed) {
    this.sidebarCollapsed = collapsed;
    this.element.classList.toggle('sidebar-collapsed', collapsed);
    this.sidebar.updateCollapsedState();
  }

  openMobileSidebar() {
    this.sidebarMobileOpen = true;
    this.sidebar.openMobile();
  }

  closeMobileSidebar() {
    this.sidebarMobileOpen = false;
    this.sidebar.closeMobile();
  }

  toggleMobileSidebar() {
    if (this.sidebarMobileOpen) this.closeMobileSidebar();
    else this.openMobileSidebar();
  }

  // Mini player controls
  toggleMiniPlayer() {
    this.miniPlayerHidden = !this.miniPlayerHidden;
    this.element.classList.toggle('mini-player-hidden', this.miniPlayerHidden);
  }

  // Pomodoro
  async handlePomodoroComplete(mode) {
    if (mode === 'break') { // means focus just ended
      triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
      
      // Save to SQL backend
      try {
        const res = await api.post('/progress/study', {
          type: 'pomodoro',
          duration: 25 * 60
        });
        if (res.success) {
          this.setUser({ xp: this.user.xp + res.data.xp_earned });
        }
      } catch (e) {
        console.error('Failed to save pomodoro session', e);
      }
    }
  }

  // Theme
  toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.header.updateThemeIcons(!isDark);
  }

  // Search
  async handleSearch(query, callback) {
    callback([]);
  }

  // User menu actions
  handleUserMenuAction(action) {
    switch (action) {
      case 'profile':
        this.navigate('profile');
        break;
      case 'preferences':
        this.navigate('settings');
        break;
      case 'shortcuts':
        this.showShortcutsHelp();
        break;
      case 'help':
        this.navigate('help');
        break;
      case 'logout':
        this.logout();
        break;
    }
  }

  async logout() {
    await api.post('/auth/logout').catch(() => null);
    this.destroy();
    this.onLogout();
  }

  showShortcutsHelp() {
    const shortcuts = [
      { key: 'Espaço', action: 'Play / Pause' },
      { key: '← / →', action: '-10s / +10s' },
      { key: 'Shift + ← / →', action: '-30s / +30s' },
      { key: '↑ / ↓', action: 'Volume +5% / -5%' },
      { key: 'M', action: 'Mute' },
      { key: 'F', action: 'Fullscreen' },
      { key: 'S', action: 'Velocidade (1x→1.25→1.5→2→0.5)' },
      { key: 'N', action: 'Próximo' },
      { key: 'P', action: 'Anterior' },
      { key: 'Ctrl + K', action: 'Busca global' },
      { key: 'Ctrl + B', action: 'Toggle Sidebar' },
      { key: '?', action: 'Mostrar esta ajuda' }
    ];

    const html = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" id="shortcuts-modal">
        <div class="bg-card rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-scale-in">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-display font-semibold text-primary">Atalhos de Teclado</h2>
            <button class="btn-ghost btn-icon p-1" onclick="this.closest('#shortcuts-modal').remove()">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            ${shortcuts.map(s => `
              <div class="flex justify-between px-2 py-2 bg-secondary rounded-lg">
                <kbd class="px-2 py-1 bg-tertiary rounded text-xs font-mono text-secondary">${s.key}</kbd>
                <span class="text-sm text-primary">${s.action}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn-primary btn-full mt-4" onclick="this.closest('#shortcuts-modal').remove()">Entendi</button>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Command palette actions
  handleCommandAction(action) {
    switch (action) {
      case 'new-flashcard':
        this.navigate('flashcards');
        break;
      case 'new-note':
        this.navigate('notes');
        break;
      case 'start-review':
        this.navigate('flashcards');
        break;
      case 'open-exam':
        this.navigate('exams');
        break;
      case 'toggle-theme':
        this.toggleTheme();
        break;
      case 'toggle-sidebar':
        this.toggleSidebar();
        break;
    }
  }

  // Player handlers
  handlePlayerPlay() { console.log('Player: play'); }
  handlePlayerPause() { console.log('Player: pause'); }
  handlePlayerSeek(time) { console.log('Player: seek', time); }
  handleVolumeChange(vol) { console.log('Player: volume', vol); }
  handleMuteToggle(muted) { console.log('Player: mute', muted); }
  handleRateChange(rate) { console.log('Player: rate', rate); }
  handlePlayerNext() { console.log('Player: next'); }
  handlePlayerPrev() { console.log('Player: prev'); }
  handleFullscreen() { console.log('Player: fullscreen'); }
  handlePlayerExpand(expanded) { console.log('Player: expand', expanded); }

  // User management
  setUser(user) {
    this.user = { ...this.user, ...user };
    this.sidebar.setUser(this.user);
    this.header.setUser(this.user);
  }

  setSubjects(subjects) {
    this.subjects = subjects;
    this.sidebar.setSubjects(subjects);
  }

  setLibraryService(service) {
    this.libraryService = service;
  }

  openLocalResource(item) {
    this.pendingLocalResource = item;
    this.navigate(item.resourceType === 'audio' ? 'audio' : item.resourceType === 'video' ? 'video' : 'library');
  }

  consumeLocalResource(type) {
    if (this.pendingLocalResource?.resourceType !== type) return null;
    const item = this.pendingLocalResource;
    this.pendingLocalResource = null;
    return item;
  }

  // Player public API
  setTrack(track) {
    this.miniPlayer.setTrack(track);
  }

  setPlayerProgress(currentTime, duration) {
    this.miniPlayer.setProgress(currentTime, duration);
  }

  setPlayerPlaying(playing) {
    if (playing) this.miniPlayer.play();
    else this.miniPlayer.pause();
  }

  // Cleanup
  destroy() {
    this.activeRouteComponent?.destroy?.();
    this.sidebar.destroy();
    this.header.destroy();
    this.miniPlayer.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
