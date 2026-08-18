// src/components/Avatar.js
export class Avatar {
  constructor(options = {}) {
    this.src = options.src ?? null;
    this.alt = options.alt ?? '';
    this.name = options.name ?? '';
    this.size = options.size ?? 'md'; // xs, sm, md, lg, xl, 2xl
    this.shape = options.shape ?? 'circle'; // circle, square, rounded
    this.status = options.status ?? null; // online, offline, busy, away
    this.statusPosition = options.statusPosition ?? 'bottom-right'; // bottom-right, top-right, bottom-left, top-left
    this.onClick = options.onClick ?? null;
    this.element = null;
  }

  render() {
    const sizes = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
      '2xl': 'w-24 h-24 text-2xl'
    };

    const shapeClasses = {
      circle: 'rounded-full',
      square: 'rounded-none',
      rounded: 'rounded-xl'
    };

    const sizeClass = sizes[this.size] ?? sizes.md;
    const shapeClass = shapeClasses[this.shape] ?? shapeClasses.circle;

    this.element = document.createElement(this.onClick ? 'button' : 'div');
    this.element.className = `avatar ${sizeClass} ${shapeClass} ${this.status ? 'has-status' : ''}`;
    if (this.onClick) {
      this.element.type = 'button';
      this.element.setAttribute('aria-label', this.name ?? 'Avatar');
    }

    const initials = this.getInitials(this.name);
    const bgColor = this.getColorFromName(this.name);

    if (this.src) {
      this.element.innerHTML = `
        <img src="${this.escapeHtml(this.src)}" alt="${this.escapeHtml(this.alt)}" class="avatar-image" loading="lazy">
        ${this.status ? this.renderStatus() : ''}
      `;
    } else {
      this.element.innerHTML = `
        <div class="avatar-fallback" style="background-color: ${bgColor}">${this.escapeHtml(initials)}</div>
        ${this.status ? this.renderStatus() : ''}
      `;
    }

    if (this.onClick) {
      this.element.addEventListener('click', (e) => this.onClick(e, this));
    }

    return this.element;
  }

  renderStatus() {
    const statusColors = {
      online: '#16a34a',
      offline: '#78716c',
      busy: '#dc2626',
      away: '#f59e0b'
    };

    const positions = {
      'bottom-right': 'bottom-0 right-0',
      'top-right': 'top-0 right-0',
      'bottom-left': 'bottom-0 left-0',
      'top-left': 'top-0 left-0'
    };

    const color = statusColors[this.status] ?? statusColors.offline;
    const position = positions[this.statusPosition] ?? positions['bottom-right'];

    return `
      <span class="avatar-status ${position}" style="background-color: ${color}" aria-label="Status: ${this.status}"></span>
    `;
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getColorFromName(name) {
    if (!name) return '#a8a29e';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public methods
  setSrc(src) {
    this.src = src;
    if (this.element) {
      const fallback = this.element.querySelector('.avatar-fallback');
      const img = this.element.querySelector('.avatar-image');
      if (src) {
        if (img) {
          img.src = src;
        } else if (fallback) {
          fallback.replaceWith(`<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(this.alt)}" class="avatar-image" loading="lazy">`);
        }
      } else if (img) {
        const initials = this.getInitials(this.name);
        const bgColor = this.getColorFromName(this.name);
        img.replaceWith(`<div class="avatar-fallback" style="background-color: ${bgColor}">${this.escapeHtml(initials)}</div>`);
      }
    }
  }

  setName(name) {
    this.name = name;
    if (!this.src && this.element) {
      const fallback = this.element.querySelector('.avatar-fallback');
      if (fallback) {
        const initials = this.getInitials(name);
        const bgColor = this.getColorFromName(name);
        fallback.textContent = initials;
        fallback.style.backgroundColor = bgColor;
      }
    }
  }

  setStatus(status) {
    this.status = status;
    if (this.element) {
      const oldStatus = this.element.querySelector('.avatar-status');
      oldStatus?.remove();
      if (status) {
        this.element.insertAdjacentHTML('beforeend', this.renderStatus());
      }
    }
  }

  setSize(size) {
    this.size = size;
    this.rebuild();
  }

  setShape(shape) {
    this.shape = shape;
    this.rebuild();
  }

  rebuild() {
    const parent = this.element.parentNode;
    if (parent) {
      const newEl = this.render();
      parent.replaceChild(newEl, this.element);
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Avatar group (stacked avatars)
export class AvatarGroup {
  constructor(options = {}) {
    this.avatars = options.avatars ?? []; // Avatar options
    this.max = options.max ?? 5;
    this.size = options.size ?? 'md';
    this.overlap = options.overlap ?? true;
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `avatar-group ${this.overlap ? 'avatar-group-overlap' : ''}`;
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Avatares do grupo');

    const visibleAvatars = this.avatars.slice(0, this.max);
    const remaining = this.avatars.length - this.max;

    this.element.innerHTML = `
      ${visibleAvatars.map((avatarOptions, index) => {
        const avatar = new Avatar({ ...avatarOptions, size: this.size });
        // We need to render and get the outerHTML
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(avatar.render());
        const html = tempDiv.innerHTML;
        avatar.destroy();
        return `<div class="avatar-group-item" style="z-index: ${visibleAvatars.length - index}">${html}</div>`;
      }).join('')}
      ${remaining > 0 ? `
        <div class="avatar-group-item avatar-group-more" style="z-index: 0">
          <div class="avatar avatar-${this.size} rounded-full bg-tertiary text-secondary font-medium">
            +${remaining}
          </div>
        </div>
      ` : ''}
    `;

    return this.element;
  }

  setAvatars(avatars) {
    this.avatars = avatars;
    this.rebuild();
  }

  rebuild() {
    const parent = this.element.parentNode;
    if (parent) {
      this.element.remove();
      parent.appendChild(this.render());
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}