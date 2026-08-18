// src/components/Header.js
export class Header {
  constructor(options = {}) {
    this.onSearch = options.onSearch ?? (() => {});
    this.onSearchSelect = options.onSearchSelect ?? (() => {});
    this.onThemeToggle = options.onThemeToggle ?? (() => {});
    this.onUserMenuAction = options.onUserMenuAction ?? (() => {});
    this.onCommandPalette = options.onCommandPalette ?? (() => {});
    this.user = options.user ?? { name: 'Estudante', email: 'estudante@email.com', avatar: null };
    this.searchResults = options.searchResults ?? [];
    this.showCommandPalette = false;
    this.showUserMenu = false;
    this.showSearchResults = false;
    this.element = null;
    this.commandPalette = null;
    this.backdrop = null;
  }

  render() {
    this.element = document.createElement('header');
    this.element.className = 'app-header';
    this.element.innerHTML = `
      <div class="header-left">
        <button class="mobile-menu-btn" aria-label="Abrir menu" data-action="toggle-menu">
          <i data-lucide="menu" class="w-5 h-5"></i>
        </button>
        <div class="global-search" role="search">
          <input 
            type="search" 
            class="input" 
            placeholder="Buscar matérias, aulas, flashcards... (Ctrl+K)"
            aria-label="Busca global"
            data-action="search-input"
            autocomplete="off"
          >
          <span class="search-shortcut"><kbd>⌘</kbd><kbd>K</kbd></span>
          <div class="search-results" role="listbox" aria-label="Resultados da busca"></div>
        </div>
      </div>
      <div class="header-right">
        <button class="header-action theme-toggle" aria-label="Alternar tema" data-action="theme-toggle">
          <i data-lucide="sun" class="w-5 h-5 sun-icon"></i>
          <i data-lucide="moon" class="w-5 h-5 moon-icon"></i>
        </button>
        <button class="header-action" aria-label="Notificações" data-action="notifications">
          <i data-lucide="bell" class="w-5 h-5"></i>
          <span class="badge badge-primary" style="display: none;">3</span>
        </button>
        <button class="header-action" aria-label="Configurações" data-action="settings">
          <i data-lucide="settings" class="w-5 h-5"></i>
        </button>
        <div class="user-menu-trigger" data-action="user-menu-toggle" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false">
          <div class="user-avatar">${this.user.name.charAt(0).toUpperCase()}</div>
          <span class="user-name">${this.user.name}</span>
          <i data-lucide="chevron-down" class="w-4 h-4"></i>
        </div>
        <div class="user-menu-dropdown" role="menu">
          <div class="user-menu-header">
            <div class="user-menu-name">${this.user.name}</div>
            <div class="user-menu-email">${this.user.email}</div>
          </div>
          <button class="user-menu-item" data-action="profile" role="menuitem">
            <i data-lucide="user" class="w-4 h-4"></i>
            Perfil
          </button>
          <button class="user-menu-item" data-action="preferences" role="menuitem">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
            Preferências
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item" data-action="shortcuts" role="menuitem">
            <i data-lucide="keyboard" class="w-4 h-4"></i>
            Atalhos
          </button>
          <button class="user-menu-item" data-action="help" role="menuitem">
            <i data-lucide="help-circle" class="w-4 h-4"></i>
            Ajuda
          </button>
          <div class="user-menu-divider"></div>
          <button class="user-menu-item danger" data-action="logout" role="menuitem">
            <i data-lucide="log-out" class="w-4 h-4"></i>
            Sair
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    return this.element;
  }

  bindEvents() {
    // Mobile menu toggle
    const menuBtn = this.element.querySelector('[data-action="toggle-menu"]');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        this.element.dispatchEvent(new CustomEvent('header:toggle-menu'));
      });
    }

    // Search input
    const searchInput = this.element.querySelector('[data-action="search-input"]');
    const searchResults = this.element.querySelector('.search-results');
    
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length >= 2) {
          debounceTimer = setTimeout(() => {
            this.onSearch(query, (results) => {
              this.searchResults = results;
              this.renderSearchResults();
            });
          }, 150);
        } else {
          this.hideSearchResults();
        }
      });

      searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
          this.showSearchResults();
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.hideSearchResults();
          searchInput.blur();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.focusNextResult();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.focusPrevResult();
        } else if (e.key === 'Enter') {
          const highlighted = searchResults.querySelector('[role="option"].highlighted');
          if (highlighted) {
            e.preventDefault();
            highlighted.click();
          }
        }
      });
    }

    // Click outside to close search results
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target)) {
        this.hideSearchResults();
      }
    });

    // Theme toggle
    const themeToggle = this.element.querySelector('[data-action="theme-toggle"]');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.onThemeToggle();
      });
    }

    // User menu
    const userMenuTrigger = this.element.querySelector('[data-action="user-menu-toggle"]');
    const userMenuDropdown = this.element.querySelector('.user-menu-dropdown');
    
    if (userMenuTrigger && userMenuDropdown) {
      userMenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleUserMenu();
      });

      userMenuTrigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleUserMenu();
        } else if (e.key === 'Escape') {
          this.closeUserMenu();
        }
      });

      userMenuDropdown.querySelectorAll('[data-action]').forEach(item => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          this.onUserMenuAction(action);
          this.closeUserMenu();
        });
      });
    }

    // Click outside to close user menu
    document.addEventListener('click', (e) => {
      if (this.showUserMenu && !this.element.querySelector('.user-menu-trigger').contains(e.target) && !userMenuDropdown?.contains(e.target)) {
        this.closeUserMenu();
      }
    });
  }

  renderSearchResults() {
    const searchResults = this.element.querySelector('.search-results');
    if (!searchResults) return;

    if (this.searchResults.length === 0) {
      searchResults.innerHTML = `
        <div class="search-results-empty">
          <i data-lucide="search-x" class="w-8 h-8 mx-auto mb-2 text-muted"></i>
          <p>Nenhum resultado para "${this.element.querySelector('[data-action="search-input"]').value}"</p>
        </div>
      `;
    } else {
      const grouped = this.groupResults(this.searchResults);
      searchResults.innerHTML = Object.entries(grouped).map(([category, items]) => `
        <div class="search-results-header">${category}</div>
        ${items.map(item => `
          <a href="#" class="search-result-item" role="option" data-route="${item.route}" data-id="${item.id}">
            <i data-lucide="${item.icon}" class="w-5 h-5"></i>
            <div class="search-result-content">
              <div class="search-result-title">${this.highlightMatch(item.title, this.element.querySelector('[data-action="search-input"]').value)}</div>
              <div class="search-result-meta">${item.meta}</div>
            </div>
          </a>
        `).join('')}
      `).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.showSearchResults();
  }

  groupResults(results) {
    const groups = {};
    results.forEach(r => {
      const cat = r.category || 'Resultados';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }

  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark style="background: var(--warning-bg); color: var(--warning); padding: 0 2px; border-radius: 2px;">$1</mark>');
  }

  showSearchResults() {
    const searchResults = this.element.querySelector('.search-results');
    if (searchResults) {
      searchResults.classList.add('open');
      this.showSearchResults = true;
    }
  }

  hideSearchResults() {
    const searchResults = this.element.querySelector('.search-results');
    if (searchResults) {
      searchResults.classList.remove('open');
      this.showSearchResults = false;
    }
  }

  focusNextResult() {
    const results = this.element.querySelector('.search-results');
    const items = results?.querySelectorAll('[role="option"]');
    if (!items?.length) return;
    
    const current = results.querySelector('[role="option"].highlighted');
    let index = current ? Array.from(items).indexOf(current) : -1;
    index = (index + 1) % items.length;
    items.forEach((item, i) => item.classList.toggle('highlighted', i === index));
    items[index]?.scrollIntoView({ block: 'nearest' });
  }

  focusPrevResult() {
    const results = this.element.querySelector('.search-results');
    const items = results?.querySelectorAll('[role="option"]');
    if (!items?.length) return;
    
    const current = results.querySelector('[role="option"].highlighted');
    let index = current ? Array.from(items).indexOf(current) : 0;
    index = (index - 1 + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle('highlighted', i === index));
    items[index]?.scrollIntoView({ block: 'nearest' });
  }

  toggleUserMenu() {
    const dropdown = this.element.querySelector('.user-menu-dropdown');
    const trigger = this.element.querySelector('[data-action="user-menu-toggle"]');
    this.showUserMenu = !this.showUserMenu;
    dropdown?.classList.toggle('open', this.showUserMenu);
    trigger?.setAttribute('aria-expanded', this.showUserMenu);
  }

  closeUserMenu() {
    const dropdown = this.element.querySelector('.user-menu-dropdown');
    const trigger = this.element.querySelector('[data-action="user-menu-toggle"]');
    this.showUserMenu = false;
    dropdown?.classList.remove('open');
    trigger?.setAttribute('aria-expanded', 'false');
  }

  // Command Palette (Ctrl+K)
  showCommandPalette(commands = []) {
    if (this.commandPalette) return;
    
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'command-palette-backdrop open';
    
    this.commandPalette = document.createElement('div');
    this.commandPalette.className = 'command-palette open';
    this.commandPalette.innerHTML = `
      <div class="command-palette-shortcut">
        <kbd>⌘</kbd><kbd>K</kbd> Abrir paleta de comandos
        <span style="margin-left: auto; color: var(--text-muted);">Esc para fechar</span>
      </div>
      <input type="text" class="command-palette-input" placeholder="Digite um comando ou busque..." autocomplete="off" spellcheck="false">
      <div class="command-palette-results"></div>
    `;
    
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.commandPalette);
    document.body.style.overflow = 'hidden';
    
    const input = this.commandPalette.querySelector('.command-palette-input');
    input.focus();
    
    const filterCommands = (query) => {
      const results = this.commandPalette.querySelector('.command-palette-results');
      if (!query) {
        results.innerHTML = '';
        return;
      }
      
      const filtered = commands.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.shortcut.toLowerCase().includes(query.toLowerCase())
      );
      
      results.innerHTML = filtered.map(cmd => `
        <a href="#" class="command-palette-item" data-action="${cmd.action}">
          <div class="command-palette-item-content">
            <i data-lucide="${cmd.icon}" class="w-5 h-5"></i>
            <div>
              <div class="command-palette-item-title">${cmd.title}</div>
              <div class="command-palette-item-desc">${cmd.description}</div>
            </div>
          </div>
          <span class="command-palette-item-shortcut">${cmd.shortcut}</span>
        </a>
      `).join('');
      
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };
    
    input.addEventListener('input', (e) => filterCommands(e.target.value));
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeCommandPalette();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = this.commandPalette.querySelectorAll('.command-palette-item');
        const current = this.commandPalette.querySelector('.command-palette-item.selected');
        let index = current ? Array.from(items).indexOf(current) : -1;
        index = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.forEach((item, i) => item.classList.toggle('selected', i === index));
        items[index]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const selected = this.commandPalette.querySelector('.command-palette-item.selected');
        if (selected) {
          e.preventDefault();
          selected.click();
        }
      }
    });
    
    this.commandPalette.querySelector('.command-palette-results').addEventListener('click', (e) => {
      const item = e.target.closest('.command-palette-item');
      if (item) {
        e.preventDefault();
        const action = item.dataset.action;
        this.onCommandPalette(action);
        this.closeCommandPalette();
      }
    });
    
    this.backdrop.addEventListener('click', () => this.closeCommandPalette());
  }

  closeCommandPalette() {
    if (this.commandPalette) {
      this.commandPalette.remove();
      this.commandPalette = null;
    }
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    document.body.style.overflow = '';
  }

  setUser(user) {
    this.user = { ...this.user, ...user };
    if (this.element) {
      const avatar = this.element.querySelector('.user-avatar');
      const name = this.element.querySelector('.user-name');
      const menuName = this.element.querySelector('.user-menu-name');
      const menuEmail = this.element.querySelector('.user-menu-email');
      if (avatar) avatar.textContent = this.user.name.charAt(0).toUpperCase();
      if (name) name.textContent = this.user.name;
      if (menuName) menuName.textContent = this.user.name;
      if (menuEmail) menuEmail.textContent = this.user.email;
    }
  }

  updateThemeIcons(isDark) {
    // Icons are handled by CSS [data-theme] selector
  }

  destroy() {
    this.closeCommandPalette();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}