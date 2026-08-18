// src/components/Modal.js
export class Modal {
  constructor(options = {}) {
    this.title = options.title ?? '';
    this.content = options.content ?? '';
    this.size = options.size ?? 'md'; // sm, md, lg, xl, full
    this.showClose = options.showClose ?? true;
    this.closeOnOverlay = options.closeOnOverlay ?? true;
    this.closeOnEscape = options.closeOnEscape ?? true;
    this.persistent = options.persistent ?? false; // if true, doesn't close on overlay/escape
    this.footer = options.footer ?? null;
    this.onClose = options.onClose ?? (() => {});
    this.onOpen = options.onOpen ?? (() => {});
    this.trapFocus = options.trapFocus ?? true;
    this.element = null;
    this.backdrop = null;
    this.previousActiveElement = null;
    this.focusableElements = [];
    this.firstFocusable = null;
    this.lastFocusable = null;
  }

  render() {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');

    // Create modal
    this.element = document.createElement('div');
    this.element.className = `modal modal-${this.size}`;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-labelledby', this.title ? 'modal-title' : undefined);
    
    this.element.innerHTML = `
      <div class="modal-content">
        ${this.title ? `
          <div class="modal-header">
            <h2 id="modal-title" class="modal-title">${this.escapeHtml(this.title)}</h2>
            ${this.showClose ? `
              <button type="button" class="modal-close" aria-label="Fechar modal" data-action="close">
                <i data-lucide="x" class="w-5 h-5" aria-hidden="true"></i>
              </button>
            ` : ''}
          </div>
        ` : ''}
        <div class="modal-body">${this.content}</div>
        ${this.footer ? `
          <div class="modal-footer">${this.footer}</div>
        ` : ''}
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return { modal: this.element, backdrop: this.backdrop };
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

    // Backdrop click
    if (this.closeOnOverlay && !this.persistent) {
      this.backdrop.addEventListener('click', () => this.close());
    }

    // Escape key
    if (this.closeOnEscape && !this.persistent) {
      this.keydownHandler = (e) => {
        if (e.key === 'Escape') this.close();
        else if (e.key === 'Tab' && this.trapFocus) this.trapFocusTab(e);
      };
      document.addEventListener('keydown', this.keydownHandler);
    }
  }

  trapFocusTab(e) {
    this.updateFocusableElements();
    if (!this.firstFocusable || !this.lastFocusable) return;

    if (e.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } else {
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  }

  updateFocusableElements() {
    this.focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];
  }

  open() {
    // Save previous active element
    this.previousActiveElement = document.activeElement;

    // Add to DOM
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.element);
    document.body.style.overflow = 'hidden';

    // Trigger reflow for animation
    requestAnimationFrame(() => {
      this.backdrop.classList.add('open');
      this.element.classList.add('open');
    });

    // Focus management
    this.updateFocusableElements();
    const firstInput = this.element.querySelector('input, select, textarea, button:not(.modal-close)');
    (firstInput || this.firstFocusable || this.element)?.focus();

    this.onOpen(this);
  }

  close() {
    if (!this.element?.parentNode) return;

    this.backdrop.classList.remove('open');
    this.element.classList.remove('open');

    // Cleanup after animation
    setTimeout(() => {
      if (this.backdrop.parentNode) this.backdrop.parentNode.removeChild(this.backdrop);
      if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
      document.body.style.overflow = '';
      
      // Restore focus
      if (this.previousActiveElement) {
        this.previousActiveElement.focus();
      }

      // Remove keydown listener
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
      }

      this.onClose(this);
    }, 250);
  }

  setContent(content) {
    this.content = content;
    const body = this.element.querySelector('.modal-body');
    if (body) body.innerHTML = content;
  }

  setTitle(title) {
    this.title = title;
    const titleEl = this.element.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = title;
  }

  setFooter(footer) {
    this.footer = footer;
    const footerEl = this.element.querySelector('.modal-footer');
    if (footerEl) footerEl.innerHTML = footer;
  }

  destroy() {
    this.close();
    // Ensure cleanup
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
  }
}

// Alert/Confirm/Modal prompt helpers
export function alertModal(message, options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title ?? 'Aviso',
      content: `<p class="text-primary">${message}</p>`,
      size: 'sm',
      footer: `
        <button type="button" class="btn btn-primary btn-full" data-action="ok">OK</button>
      `,
      onClose: () => resolve(true)
    });

    const { modal: el, backdrop } = modal.render();
    document.body.appendChild(backdrop);
    document.body.appendChild(el);

    el.querySelector('[data-action="ok"]').addEventListener('click', () => {
      modal.close();
    });

    modal.open();
  });
}

export function confirmModal(message, options = {}) {
  return new Promise((resolve) => {
    const modal = new Modal({
      title: options.title ?? 'Confirmação',
      content: `<p class="text-primary">${message}</p>`,
      size: 'sm',
      footer: `
        <button type="button" class="btn btn-secondary" data-action="cancel">${options.cancelText ?? 'Cancelar'}</button>
        <button type="button" class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${options.confirmText ?? 'Confirmar'}</button>
      `,
      onClose: () => resolve(false)
    });

    const { modal: el, backdrop } = modal.render();
    document.body.appendChild(backdrop);
    document.body.appendChild(el);

    el.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      modal.close();
      resolve(true);
    });

    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      modal.close();
      resolve(false);
    });

    modal.open();
  });
}

export function promptModal(message, options = {}) {
  return new Promise((resolve) => {
    const inputId = `prompt-input-${Date.now()}`;
    const modal = new Modal({
      title: options.title ?? 'Entrada',
      content: `
        <p class="text-primary mb-4">${message}</p>
        <input type="${options.type ?? 'text'}" id="${inputId}" class="input" placeholder="${options.placeholder ?? ''}" value="${options.defaultValue ?? ''}" autofocus>
        ${options.error ? `<p class="input-error-message mt-2">${options.error}</p>` : ''}
      `,
      size: 'sm',
      footer: `
        <button type="button" class="btn btn-secondary" data-action="cancel">${options.cancelText ?? 'Cancelar'}</button>
        <button type="button" class="btn btn-primary" data-action="confirm">${options.confirmText ?? 'OK'}</button>
      `,
      onClose: () => resolve(null)
    });

    const { modal: el, backdrop } = modal.render();
    document.body.appendChild(backdrop);
    document.body.appendChild(el);

    const input = el.querySelector(`#${inputId}`);
    input.focus();

    const handleConfirm = () => {
      modal.close();
      resolve(input.value);
    };

    const handleCancel = () => {
      modal.close();
      resolve(null);
    };

    el.querySelector('[data-action="confirm"]').addEventListener('click', handleConfirm);
    el.querySelector('[data-action="cancel"]').addEventListener('click', handleCancel);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') handleCancel();
    });

    modal.open();
  });
}