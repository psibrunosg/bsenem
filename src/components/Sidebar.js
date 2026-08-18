// src/components/Sidebar.js
export class Sidebar {
  constructor(options = {}) {
    this.collapsed = options.collapsed ?? false;
    this.mobileOpen = false;
    this.onNavigate = options.onNavigate ?? (() => {});
    this.onToggleCollapse = options.onToggleCollapse ?? (() => {});
    this.currentRoute = options.currentRoute ?? 'dashboard';
    this.user = options.user ?? { name: 'Estudante', level: 1, xp: 0, xpMax: 1000, streak: 0 };
    this.subjects = options.subjects ?? [];
    this.element = null;
    this.overlay = null;
  }

  render() {
    const navSections = [
      {
        title: 'Principal',
        items: [
          { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
          { id: 'study', icon: 'book-open', label: 'Estudar' },
          { id: 'review', icon: 'rotate-ccw', label: 'Revisão', badge: '12' }
        ]
      },
      {
        title: 'Conteúdo',
        items: [
          { id: 'video', icon: 'play-circle', label: 'Videoaulas' },
          { id: 'audio', icon: 'music', label: 'Áudios' },
          { id: 'pdf', icon: 'file-text', label: 'PDFs' },
          { id: 'flashcards', icon: 'card-stack', label: 'Flashcards' }
        ]
      },
      {
        title: 'Ferramentas',
        items: [
          { id: 'notes', icon: 'pen-tool', label: 'Anotações' },
          { id: 'exams', icon: 'clipboard-check', label: 'Simulados' },
          { id: 'stats', icon: 'bar-chart-2', label: 'Estatísticas' }
        ]
      }
    ];

    const xpPercent = Math.min(100, (this.user.xp / this.user.xpMax) * 100);

    this.element = document.createElement('aside');
    this.element.className = `app-sidebar ${this.collapsed ? 'collapsed' : ''} ${this.mobileOpen ? 'open' : ''}`;
    this.element.innerHTML = `
      <div class="sidebar-header">
        <a href="#" class="sidebar-logo" data-route="dashboard">
          <i data-lucide="book-open" class="sidebar-logo-icon"></i>
          <span class="sidebar-label">BS Estudos</span>
        </a>
        <button class="sidebar-toggle" aria-label="${this.collapsed ? 'Expandir' : 'Colapsar'} sidebar" data-action="toggle-collapse">
          <i data-lucide="${this.collapsed ? 'chevron-right' : 'chevron-left'}" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="sidebar-search">
        <input type="search" class="input" placeholder="Buscar matérias..." aria-label="Buscar matérias">
      </div>

      <nav class="sidebar-nav" aria-label="Navegação principal">
        ${navSections.map(section => `
          <div class="nav-section">
            <div class="sidebar-section-title">${section.title}</div>
            ${section.items.map(item => `
              <a href="#" class="nav-item ${this.currentRoute === item.id ? 'active' : ''}" data-route="${item.id}" aria-current="${this.currentRoute === item.id ? 'page' : 'false'}">
                <i data-lucide="${item.icon}" class="w-5 h-5"></i>
                <span class="sidebar-label">${item.label}</span>
                ${item.badge ? `<span class="badge badge-primary nav-badge">${item.badge}</span>` : ''}
              </a>
            `).join('')}
          </div>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">${this.user.name.charAt(0).toUpperCase()}</div>
          <div class="user-details">
            <div class="user-name">${this.user.name}</div>
            <div class="user-level">Nível ${this.user.level} • ${this.user.xp}/${this.user.xpMax} XP</div>
          </div>
        </div>
        <div class="sidebar-xp" role="progressbar" aria-valuenow="${xpPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de XP">
          <div class="sidebar-xp-fill" style="width: ${xpPercent}%"></div>
        </div>
        <div class="streak-indicator">
          <i data-lucide="flame" class="w-3 h-3"></i>
          <span>${this.user.streak} dias de streak</span>
        </div>
      </div>
    `;

    // Create overlay for mobile
    this.overlay = document.createElement('div');
    this.overlay.className = 'sidebar-overlay';
    this.overlay.setAttribute('data-action', 'close-mobile');

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    return this.element;
  }

  bindEvents() {
    // Toggle collapse
    const toggleBtn = this.element.querySelector('[data-action="toggle-collapse"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.collapsed = !this.collapsed;
        this.updateCollapsedState();
        this.onToggleCollapse(this.collapsed);
      });
    }

    // Navigation items
    this.element.querySelectorAll('[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.dataset.route;
        this.setActiveRoute(route);
        this.onNavigate(route);
        if (this.mobileOpen) this.closeMobile();
      });
    });

    // Overlay click
    this.overlay.addEventListener('click', () => this.closeMobile());
  }

  updateCollapsedState() {
    this.element.classList.toggle('collapsed', this.collapsed);
    const toggleBtn = this.element.querySelector('[data-action="toggle-collapse"]');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', this.collapsed ? 'chevron-right' : 'chevron-left');
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  setActiveRoute(route) {
    this.currentRoute = route;
    this.element.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === route);
      item.setAttribute('aria-current', item.dataset.route === route ? 'page' : 'false');
    });
  }

  openMobile() {
    this.mobileOpen = true;
    this.element.classList.add('open');
    this.overlay.classList.add('visible');
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden';
  }

  closeMobile() {
    this.mobileOpen = false;
    this.element.classList.remove('open');
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      if (this.overlay.parentNode) this.overlay.parentNode.removeChild(this.overlay);
    }, 250);
    document.body.style.overflow = '';
  }

  setUser(user) {
    this.user = { ...this.user, ...user };
    if (this.element) {
      const footer = this.element.querySelector('.sidebar-footer');
      if (footer) {
        const xpPercent = Math.min(100, (this.user.xp / this.user.xpMax) * 100);
        footer.innerHTML = `
          <div class="user-info">
            <div class="user-avatar">${this.user.name.charAt(0).toUpperCase()}</div>
            <div class="user-details">
              <div class="user-name">${this.user.name}</div>
              <div class="user-level">Nível ${this.user.level} • ${this.user.xp}/${this.user.xpMax} XP</div>
            </div>
          </div>
          <div class="sidebar-xp" role="progressbar" aria-valuenow="${xpPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de XP">
            <div class="sidebar-xp-fill" style="width: ${xpPercent}%"></div>
          </div>
          <div class="streak-indicator">
            <i data-lucide="flame" class="w-3 h-3"></i>
            <span>${this.user.streak} dias de streak</span>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }

  setSubjects(subjects) {
    this.subjects = subjects;
    // Could rebuild nav sections with dynamic subjects
  }

  destroy() {
    this.closeMobile();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
    if (this.overlay?.parentNode) this.overlay.parentNode.removeChild(this.overlay);
  }
}