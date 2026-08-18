// src/components/Toast.js
export class Toast {
  constructor(options = {}) {
    this.message = options.message ?? '';
    this.type = options.type ?? 'info'; // info, success, warning, error, achievement
    this.title = options.title ?? null;
    this.duration = options.duration ?? (options.type === 'achievement' ? 6000 : 4000);
    this.action = options.action ?? null; // { label, onClick }
    this.dismissible = options.dismissible ?? true;
    this.icon = options.icon ?? this.getDefaultIcon();
    this.onClose = options.onClose ?? (() => {});
    this.element = null;
    this.timeoutId = null;
    this.isClosing = false;
  }

  getDefaultIcon() {
    const icons = {
      info: 'info',
      success: 'check-circle',
      warning: 'alert-triangle',
      error: 'alert-circle',
      achievement: 'award'
    };
    return icons[this.type] ?? 'info';
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `toast toast-${this.type} ${this.type === 'achievement' ? 'toast-achievement' : ''}`;
    this.element.setAttribute('role', 'alert');
    this.element.setAttribute('aria-live', this.type === 'error' ? 'assertive' : 'polite');
    
    this.element.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${this.icon}" class="w-5 h-5" aria-hidden="true"></i>
      </div>
      <div class="toast-content">
        ${this.title ? `<div class="toast-title">${this.escapeHtml(this.title)}</div>` : ''}
        <div class="toast-message">${this.escapeHtml(this.message)}</div>
        ${this.action ? `
          <button type="button" class="toast-action" data-action="toast-action">
            ${this.escapeHtml(this.action.label)}
          </button>
        ` : ''}
      </div>
      ${this.dismissible ? `
        <button type="button" class="toast-close" aria-label="Dispensar" data-action="close">
          <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
        </button>
      ` : ''}
      <div class="toast-progress" aria-hidden="true"></div>
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
    const actionBtn = this.element.querySelector('[data-action="toast-action"]');
    if (actionBtn && this.action) {
      actionBtn.addEventListener('click', () => {
        this.action.onClick(this);
        if (this.action.closeOnClick !== false) this.close();
      });
    }

    // Pause on hover
    this.element.addEventListener('mouseenter', () => this.pause());
    this.element.addEventListener('mouseleave', () => this.resume());
  }

  show(container) {
    const toastContainer = container ?? Toast.getContainer();
    toastContainer.appendChild(this.element);
    
    // Trigger entrance animation
    requestAnimationFrame(() => {
      this.element.classList.add('toast-enter');
      this.startProgress();
    });

    // Auto dismiss
    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => this.close(), this.duration);
    }
  }

  startProgress() {
    const progress = this.element.querySelector('.toast-progress');
    if (!progress) return;
    
    progress.style.transition = `width ${this.duration}ms linear`;
    progress.style.width = '100%';
    
    // Force reflow
    progress.offsetWidth;
    progress.style.width = '0%';
  }

  pause() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    const progress = this.element.querySelector('.toast-progress');
    if (progress) {
      progress.style.transition = 'none';
      const computed = getComputedStyle(progress);
      progress.style.width = computed.width;
    }
  }

  resume() {
    if (this.duration > 0 && !this.isClosing) {
      const progress = this.element.querySelector('.toast-progress');
      const remaining = this.getRemainingTime(progress);
      
      if (progress) {
        progress.style.transition = `width ${remaining}ms linear`;
        progress.style.width = '0%';
      }
      
      this.timeoutId = setTimeout(() => this.close(), remaining);
    }
  }

  getRemainingTime(progress) {
    if (!progress) return this.duration;
    const currentWidth = parseFloat(getComputedStyle(progress).width);
    const totalWidth = progress.parentElement.offsetWidth;
    return Math.max(0, (currentWidth / totalWidth) * this.duration);
  }

  close() {
    if (this.isClosing) return;
    this.isClosing = true;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.element.classList.add('toast-exit');
    
    setTimeout(() => {
      if (this.element?.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      this.onClose(this);
    }, 300);
  }

  // Static methods for container management
  static getContainer(position = 'top-right') {
    let container = document.getElementById(`toast-container-${position}`);
    if (!container) {
      container = document.createElement('div');
      container.id = `toast-container-${position}`;
      container.className = `toast-container toast-container-${position}`;
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-label', 'Notificações');
      document.body.appendChild(container);
    }
    return container;
  }

  static show(message, options = {}) {
    const toast = new Toast({ message, ...options });
    toast.show();
    return toast;
  }

  static success(message, options = {}) {
    return Toast.show(message, { ...options, type: 'success', icon: 'check-circle' });
  }

  static error(message, options = {}) {
    return Toast.show(message, { ...options, type: 'error', icon: 'alert-circle', duration: 6000 });
  }

  static warning(message, options = {}) {
    return Toast.show(message, { ...options, type: 'warning', icon: 'alert-triangle' });
  }

  static info(message, options = {}) {
    return Toast.show(message, { ...options, type: 'info', icon: 'info' });
  }

  static achievement(message, options = {}) {
    return Toast.show(message, { 
      ...options, 
      type: 'achievement', 
      icon: 'award', 
      duration: 6000,
      title: options.title ?? 'Conquista Desbloqueada!'
    });
  }

  static destroyAll() {
    document.querySelectorAll('[id^="toast-container-"]').forEach(c => c.remove());
  }
}