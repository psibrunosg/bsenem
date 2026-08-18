// src/components/Tooltip.js
export class Tooltip {
  constructor(options = {}) {
    this.content = options.content ?? '';
    this.target = options.target ?? null; // HTMLElement or selector
    this.position = options.position ?? 'top'; // top, bottom, left, right
    this.offset = options.offset ?? 8;
    this.delay = options.delay ?? 200;
    this.interactive = options.interactive ?? false; // allow hover on tooltip
    this.trigger = options.trigger ?? 'hover'; // hover, click, focus
    this.arrow = options.arrow ?? true;
    this.className = options.className ?? '';
    this.onShow = options.onShow ?? (() => {});
    this.onHide = options.onHide ?? (() => {});
    this.element = null;
    this.timeoutId = null;
    this.isVisible = false;
    this.boundShow = this.show.bind(this);
    this.boundHide = this.hide.bind(this);
    this.boundToggle = this.toggle.bind(this);
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `tooltip tooltip-${this.position} ${this.className}`;
    this.element.setAttribute('role', 'tooltip');
    this.element.style.display = 'none';
    
    this.element.innerHTML = `
      <div class="tooltip-content">${this.content}</div>
      ${this.arrow ? '<div class="tooltip-arrow" aria-hidden="true"></div>' : ''}
    `;

    if (this.target) {
      this.attach(typeof this.target === 'string' ? document.querySelector(this.target) : this.target);
    }

    return this.element;
  }

  attach(target) {
    if (!target) return;
    
    this.target = target;
    document.body.appendChild(this.element);

    switch (this.trigger) {
      case 'hover':
        target.addEventListener('mouseenter', this.boundShow);
        target.addEventListener('mouseleave', this.boundHide);
        if (this.interactive) {
          this.element.addEventListener('mouseenter', () => clearTimeout(this.timeoutId));
          this.element.addEventListener('mouseleave', this.boundHide);
        }
        break;
      case 'click':
        target.addEventListener('click', this.boundToggle);
        document.addEventListener('click', (e) => {
          if (this.isVisible && !this.target.contains(e.target) && !this.element.contains(e.target)) {
            this.hide();
          }
        });
        break;
      case 'focus':
        target.addEventListener('focus', this.boundShow);
        target.addEventListener('blur', this.boundHide);
        break;
    }

    // Keyboard support
    target.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  detach() {
    if (!this.target) return;
    
    this.target.removeEventListener('mouseenter', this.boundShow);
    this.target.removeEventListener('mouseleave', this.boundHide);
    this.target.removeEventListener('click', this.boundToggle);
    this.target.removeEventListener('focus', this.boundShow);
    this.target.removeEventListener('blur', this.boundHide);
    this.target = null;
  }

  show() {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      if (!this.target) return;
      
      this.isVisible = true;
      this.updatePosition();
      this.element.style.display = 'block';
      
      // Force reflow for animation
      requestAnimationFrame(() => {
        this.element.classList.add('tooltip-visible');
      });
      
      this.onShow(this);
    }, this.delay);
  }

  hide() {
    clearTimeout(this.timeoutId);
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.element.classList.remove('tooltip-visible');
    
    setTimeout(() => {
      if (!this.isVisible) {
        this.element.style.display = 'none';
      }
    }, 200);
    
    this.onHide(this);
  }

  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  updatePosition() {
    if (!this.target || !this.element) return;

    const targetRect = this.target.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();
    const arrowSize = this.arrow ? 8 : 0;
    const offset = this.offset + arrowSize;

    let top, left;

    switch (this.position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + offset;
        break;
    }

    // Prevent viewport overflow
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    if (left < padding) left = padding;
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    this.element.style.top = `${top + window.scrollY}px`;
    this.element.style.left = `${left + window.scrollX}px`;

    // Update arrow position if needed
    const arrow = this.element.querySelector('.tooltip-arrow');
    if (arrow) {
      arrow.style.left = '';
      arrow.style.right = '';
      arrow.style.top = '';
      arrow.style.bottom = '';
      
      switch (this.position) {
        case 'top':
          arrow.style.bottom = '-4px';
          arrow.style.left = '50%';
          arrow.style.transform = 'translateX(-50%)';
          break;
        case 'bottom':
          arrow.style.top = '-4px';
          arrow.style.left = '50%';
          arrow.style.transform = 'translateX(-50%)';
          break;
        case 'left':
          arrow.style.right = '-4px';
          arrow.style.top = '50%';
          arrow.style.transform = 'translateY(-50%)';
          break;
        case 'right':
          arrow.style.left = '-4px';
          arrow.style.top = '50%';
          arrow.style.transform = 'translateY(-50%)';
          break;
      }
    }
  }

  setContent(content) {
    this.content = content;
    const contentEl = this.element.querySelector('.tooltip-content');
    if (contentEl) contentEl.innerHTML = content;
  }

  setPosition(position) {
    this.position = position;
    this.element.className = `tooltip tooltip-${position} ${this.className}`;
  }

  destroy() {
    this.detach();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Global tooltip registry for data-tooltip attributes
export function initTooltips(selector = '[data-tooltip]') {
  document.querySelectorAll(selector).forEach(el => {
    const content = el.getAttribute('data-tooltip');
    const position = el.getAttribute('data-tooltip-position') ?? 'top';
    const delay = parseInt(el.getAttribute('data-tooltip-delay') ?? '200');
    const interactive = el.hasAttribute('data-tooltip-interactive');
    
    const tooltip = new Tooltip({
      target: el,
      content,
      position,
      delay,
      interactive
    });
    tooltip.render();
    
    // Store reference for cleanup
    el._tooltip = tooltip;
  });
}

export function destroyTooltips(selector = '[data-tooltip]') {
  document.querySelectorAll(selector).forEach(el => {
    if (el._tooltip) {
      el._tooltip.destroy();
      delete el._tooltip;
    }
  });
}