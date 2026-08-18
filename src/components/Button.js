// src/components/Button.js
export class Button {
  constructor(options = {}) {
    this.variant = options.variant ?? 'primary'; // primary, secondary, ghost, danger, outline
    this.size = options.size ?? 'md'; // sm, md, lg, icon
    this.disabled = options.disabled ?? false;
    this.loading = options.loading ?? false;
    this.fullWidth = options.fullWidth ?? false;
    this.leftIcon = options.leftIcon ?? null;
    this.rightIcon = options.rightIcon ?? null;
    this.onClick = options.onClick ?? (() => {});
    this.type = options.type ?? 'button';
    this.children = options.children ?? '';
    this.ariaLabel = options.ariaLabel ?? null;
    this.ariaPressed = options.ariaPressed ?? null;
    this.ariaExpanded = options.ariaExpanded ?? null;
    this.ariaControls = options.ariaControls ?? null;
    this.element = null;
  }

  render() {
    this.element = document.createElement('button');
    this.element.type = this.type;
    this.element.className = this.getClasses();
    this.element.disabled = this.disabled || this.loading;
    
    if (this.ariaLabel) this.element.setAttribute('aria-label', this.ariaLabel);
    if (this.ariaPressed !== null) this.element.setAttribute('aria-pressed', this.ariaPressed);
    if (this.ariaExpanded !== null) this.element.setAttribute('aria-expanded', this.ariaExpanded);
    if (this.ariaControls) this.element.setAttribute('aria-controls', this.ariaControls);
    if (this.loading) this.element.setAttribute('aria-busy', 'true');

    this.element.innerHTML = this.getInnerHTML();
    
    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  getClasses() {
    const classes = ['btn'];
    
    // Variant
    classes.push(`btn-${this.variant}`);
    
    // Size
    if (this.size !== 'md') classes.push(`btn-${this.size}`);
    
    // Full width
    if (this.fullWidth) classes.push('btn-full');
    
    // State
    if (this.loading) classes.loading = 'loading';
    if (this.disabled) classes.push('disabled');
    
    return classes.join(' ');
  }

  getInnerHTML() {
    if (this.loading) {
      return `
        <span class="btn-spinner" aria-hidden="true">
          <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        </span>
        <span class="btn-text">${this.children}</span>
      `;
    }

    let iconHTML = '';
    if (this.leftIcon) {
      iconHTML += `<i data-lucide="${this.leftIcon}" class="w-4 h-4" aria-hidden="true"></i>`;
    }
    
    iconHTML += `<span class="btn-text">${this.children}</span>`;
    
    if (this.rightIcon) {
      iconHTML += `<i data-lucide="${this.rightIcon}" class="w-4 h-4" aria-hidden="true"></i>`;
    }

    return iconHTML;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      if (!this.disabled && !this.loading) {
        this.onClick(e, this);
      }
    });

    // Keyboard support for custom buttons
    this.element.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !this.disabled && !this.loading) {
        e.preventDefault();
        this.element.click();
      }
    });
  }

  // Public methods
  setLoading(loading) {
    this.loading = loading;
    this.element.disabled = this.disabled || this.loading;
    this.element.setAttribute('aria-busy', loading);
    this.element.innerHTML = this.getInnerHTML();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    this.element.disabled = this.disabled || this.loading;
    this.element.classList.toggle('disabled', disabled);
  }

  setVariant(variant) {
    this.variant = variant;
    this.updateClasses();
  }

  setSize(size) {
    this.size = size;
    this.updateClasses();
  }

  setChildren(children) {
    this.children = children;
    if (!this.loading) {
      const textEl = this.element.querySelector('.btn-text');
      if (textEl) textEl.textContent = children;
    }
  }

  setLeftIcon(icon) {
    this.leftIcon = icon;
    this.element.innerHTML = this.getInnerHTML();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  setRightIcon(icon) {
    this.rightIcon = icon;
    this.element.innerHTML = this.getInnerHTML();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  updateClasses() {
    this.element.className = this.getClasses();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Icon button helper
export function createIconButton(icon, options = {}) {
  return new Button({
    ...options,
    variant: options.variant ?? 'ghost',
    size: options.size ?? 'icon',
    leftIcon: icon,
    children: '',
    ariaLabel: options.ariaLabel ?? options.tooltip ?? ''
  });
}

// Button group helper
export class ButtonGroup {
  constructor(options = {}) {
    this.buttons = options.buttons ?? [];
    this.ariaLabel = options.ariaLabel ?? 'Grupo de botões';
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'btn-group';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', this.ariaLabel);

    this.buttons.forEach(btnOptions => {
      const button = new Button(btnOptions);
      this.element.appendChild(button.render());
    });

    return this.element;
  }

  destroy() {
    this.buttons.forEach(btn => btn.destroy());
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}