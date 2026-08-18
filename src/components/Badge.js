// src/components/Badge.js
export class Badge {
  constructor(options = {}) {
    this.children = options.children ?? '';
    this.variant = options.variant ?? 'primary'; // primary, secondary, success, warning, error, info, outline
    this.size = options.size ?? 'md'; // sm, md, lg
    this.dot = options.dot ?? false;
    this.removable = options.removable ?? false;
    this.onRemove = options.onRemove ?? (() => {});
    this.href = options.href ?? null;
    this.target = options.target ?? null;
    this.element = null;
  }

  render() {
    const Tag = this.href ? 'a' : 'span';
    this.element = document.createElement(Tag);
    this.element.className = `badge badge-${this.variant} badge-${this.size} ${this.dot ? 'badge-dot' : ''} ${this.removable ? 'badge-removable' : ''}`;
    
    if (this.href) {
      this.element.href = this.href;
      if (this.target) this.element.target = this.target;
    }

    this.element.innerHTML = `
      ${this.dot ? `<span class="badge-dot-indicator" aria-hidden="true"></span>` : ''}
      <span class="badge-text">${this.escapeHtml(this.children)}</span>
      ${this.removable ? `
        <button type="button" class="badge-remove" aria-label="Remover" data-action="remove">
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
    const removeBtn = this.element.querySelector('[data-action="remove"]');
    removeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onRemove(this);
    });
  }

  setChildren(children) {
    this.children = children;
    const textEl = this.element.querySelector('.badge-text');
    if (textEl) textEl.textContent = children;
  }

  setVariant(variant) {
    this.variant = variant;
    this.element.className = `badge badge-${variant} badge-${this.size} ${this.dot ? 'badge-dot' : ''} ${this.removable ? 'badge-removable' : ''}`;
  }

  setSize(size) {
    this.size = size;
    this.element.className = `badge badge-${this.variant} badge-${size} ${this.dot ? 'badge-dot' : ''} ${this.removable ? 'badge-removable' : ''}`;
  }

  setDot(dot) {
    this.dot = dot;
    this.element.classList.toggle('badge-dot', dot);
    const dotEl = this.element.querySelector('.badge-dot-indicator');
    if (dot && !dotEl) {
      this.element.insertAdjacentHTML('afterbegin', '<span class="badge-dot-indicator" aria-hidden="true"></span>');
    } else if (!dot && dotEl) {
      dotEl.remove();
    }
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}

// Badge group (for tags, filters, etc.)
export class BadgeGroup {
  constructor(options = {}) {
    this.badges = options.badges ?? []; // Badge options or strings
    this.removable = options.removable ?? false;
    this.onRemove = options.onRemove ?? (() => {});
    this.onChange = options.onChange ?? (() => {});
    this.element = null;
    this.badgeInstances = [];
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'badge-group';
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Grupo de etiquetas');

    this.badgeInstances = this.badges.map((badgeOpt, index) => {
      const options = typeof badgeOpt === 'string' ? { children: badgeOpt } : badgeOpt;
      const badge = new Badge({
        ...options,
        removable: this.removable,
        onRemove: (b) => this.handleRemove(b, index)
      });
      this.element.appendChild(badge.render());
      return badge;
    });

    return this.element;
  }

  handleRemove(badge, index) {
    this.badges.splice(index, 1);
    badge.destroy();
    this.onChange(this.badges);
    this.onRemove(badge, index);
  }

  addBadge(badgeOpt) {
    this.badges.push(badgeOpt);
    this.rebuild();
  }

  removeBadge(index) {
    if (this.badgeInstances[index]) {
      this.badgeInstances[index].destroy();
      this.badges.splice(index, 1);
      this.onChange(this.badges);
    }
  }

  clear() {
    this.badgeInstances.forEach(b => b.destroy());
    this.badges = [];
    this.badgeInstances = [];
    if (this.element) this.element.innerHTML = '';
    this.onChange(this.badges);
  }

  getBadges() {
    return this.badges;
  }

  rebuild() {
    this.badgeInstances.forEach(b => b.destroy());
    this.badgeInstances = [];
    if (this.element) this.element.innerHTML = '';
    this.badges.forEach((badgeOpt, index) => {
      const badge = new Badge({
        ...(typeof badgeOpt === 'string' ? { children: badgeOpt } : badgeOpt),
        removable: this.removable,
        onRemove: (b) => this.handleRemove(b, index)
      });
      this.badgeInstances.push(badge);
      this.element.appendChild(badge.render());
    });
  }

  destroy() {
    this.badgeInstances.forEach(b => b.destroy());
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}