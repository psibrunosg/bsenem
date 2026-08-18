// src/components/Alert.js
export class Alert {
  constructor(options = {}) {
    this.type = options.type ?? 'info'; // info, success, warning, error
    this.title = options.title ?? null;
    this.message = options.message ?? '';
    this.dismissible = options.dismissible ?? false;
    this.action = options.action ?? null; // { label, onClick, variant }
    this.icon = options.icon ?? true;
    this.className = options.className ?? '';
    this.onClose = options.onClose ?? (() => {});
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `alert alert-${this.type} ${this.className}`;
    this.element.setAttribute('role', 'alert');
    this.element.setAttribute('aria-live', this.type === 'error' ? 'assertive' : 'polite');
    
    const icons = {
      info: 'info',
      success: 'check-circle',
      warning: 'alert-triangle',
      error: 'alert-circle'
    };

    this.element.innerHTML = `
      ${this.icon ? `<div class="alert-icon"><i data-lucide="${icons[this.type]}" class="w-5 h-5" aria-hidden="true"></i></div>` : ''}
      <div class="alert-content">
        ${this.title ? `<div class="alert-title">${this.escapeHtml(this.title)}</div>` : ''}
        <div class="alert-message">${this.message}</div>
        ${this.action ? `
          <button type="button" class="alert-action btn btn-${this.action.variant ?? 'ghost'} btn-sm" data-action="alert-action">
            ${this.escapeHtml(this.action.label)}
          </button>
        ` : ''}
      </div>
      ${this.dismissible ? `
        <button type="button" class="alert-close" aria-label="Dispensar" data-action="close">
          <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
        </button>
      ` : ''}
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    // Close button
    const closeBtn = this.element.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());

    // Action button
    const actionBtn = this.element.querySelector('[data-action="alert-action"]');
    if (actionBtn && this.action) {
      actionBtn.addEventListener('click', () => {
        this.action.onClick(this);
        if (this.action.closeOnClick !== false) this.close();
      });
    }
  }

  close() {
    this.element.classList.add('alert-exit');
    setTimeout(() => {
      if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
      this.onClose(this);
    }, 250);
  }

  setMessage(message) {
    this.message = message;
    const msgEl = this.element.querySelector('.alert-message');
    if (msgEl) msgEl.innerHTML = message;
  }

  setTitle(title) {
    this.title = title;
    const titleEl = this.element.querySelector('.alert-title');
    if (titleEl) titleEl.textContent = title;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Inline alert (for forms, etc.)
export class InlineAlert {
  constructor(options = {}) {
    this.type = options.type ?? 'info';
    this.message = options.message ?? '';
    this.dismissible = options.dismissible ?? true;
    this.onClose = options.onClose ?? (() => {});
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `inline-alert inline-alert-${this.type}`;
    this.element.setAttribute('role', 'alert');
    
    const icons = {
      info: 'info',
      success: 'check-circle',
      warning: 'alert-triangle',
      error: 'alert-circle'
    };

    this.element.innerHTML = `
      <i data-lucide="${icons[this.type]}" class="w-4 h-4" aria-hidden="true"></i>
      <span class="inline-alert-message">${this.escapeHtml(this.message)}</span>
      ${this.dismissible ? `
        <button type="button" class="inline-alert-close" aria-label="Fechar" data-action="close">
          <i data-lucide="x" class="w-3 h-3" aria-hidden="true"></i>
        </button>
      ` : ''}
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    const closeBtn = this.element.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());
  }

  close() {
    this.element.classList.add('inline-alert-exit');
    setTimeout(() => {
      if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
      this.onClose(this);
    }, 200);
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Alert banner (full width, for announcements)
export class AlertBanner {
  constructor(options = {}) {
    this.type = options.type ?? 'info';
    this.message = options.message ?? '';
    this.action = options.action ?? null;
    this.dismissible = options.dismissible ?? false;
    this.sticky = options.sticky ?? true;
    this.onClose = options.onClose ?? (() => {});
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `alert-banner alert-banner-${this.type} ${this.sticky ? 'sticky' : ''}`;
    this.element.setAttribute('role', this.type === 'error' ? 'alert' : 'status');
    if (this.sticky) this.element.style.position = 'sticky';
    if (this.sticky) this.element.style.top = '0';
    if (this.sticky) this.element.style.zIndex = '100';
    
    const icons = {
      info: 'info',
      success: 'check-circle',
      warning: 'alert-triangle',
      error: 'alert-circle'
    };

    this.element.innerHTML = `
      <i data-lucide="${icons[this.type]}" class="w-5 h-5" aria-hidden="true"></i>
      <div class="alert-banner-content">
        <span class="alert-banner-message">${this.escapeHtml(this.message)}</span>
        ${this.action ? `
          <button type="button" class="alert-banner-action btn btn-${this.action.variant ?? 'ghost'} btn-sm" data-action="banner-action">
            ${this.escapeHtml(this.action.label)}
          </button>
        ` : ''}
      </div>
      ${this.dismissible ? `
        <button type="button" class="alert-banner-close" aria-label="Dispensar" data-action="close">
          <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
        </button>
      ` : ''}
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  bindEvents() {
    const closeBtn = this.element.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());

    const actionBtn = this.element.querySelector('[data-action="banner-action"]');
    if (actionBtn && this.action) {
      actionBtn.addEventListener('click', () => {
        this.action.onClick(this);
        if (this.action.closeOnClick !== false) this.close();
      });
    }
  }

  close() {
    this.element.style.animation = 'slide-up 0.3s ease-out reverse';
    setTimeout(() => {
      if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
      this.onClose(this);
    }, 300);
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}