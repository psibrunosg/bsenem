// src/components/Skeleton.js
export class Skeleton {
  constructor(options = {}) {
    this.variant = options.variant ?? 'text'; // text, circular, rectangular, card, avatar, button, input
    this.width = options.width ?? '100%';
    this.height = options.height ?? null;
    this.count = options.count ?? 1;
    this.animation = options.animation ?? 'pulse'; // pulse, wave, none
    this.className = options.className ?? '';
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `skeleton ${this.className}`;

    const skeletons = Array.from({ length: this.count }, () => this.renderSingle()).join('');
    this.element.innerHTML = skeletons;

    return this.element;
  }

  renderSingle() {
    const baseClasses = `skeleton-item skeleton-${this.variant} skeleton-${this.animation}`;
    const style = this.height ? `style="height: ${this.height}; width: ${this.width};"` : `style="width: ${this.width};"`;

    switch (this.variant) {
      case 'text':
        return `<div class="${baseClasses}" ${style}></div>`;
      case 'circular':
        return `<div class="${baseClasses}" style="width: ${this.width}; height: ${this.width}; border-radius: 50%;"></div>`;
      case 'rectangular':
        return `<div class="${baseClasses}" ${style} style="border-radius: var(--radius-lg);"></div>`;
      case 'card':
        return this.renderCardSkeleton();
      case 'avatar':
        return `<div class="${baseClasses}" style="width: ${this.width}; height: ${this.width}; border-radius: 50%;"></div>`;
      case 'button':
        return `<div class="${baseClasses}" style="width: ${this.width}; height: ${this.height ?? '40px'}; border-radius: var(--radius-lg);"></div>`;
      case 'input':
        return `<div class="${baseClasses}" style="width: ${this.width}; height: ${this.height ?? '40px'}; border-radius: var(--radius-lg);"></div>`;
      default:
        return `<div class="${baseClasses}" ${style}></div>`;
    }
  }

  renderCardSkeleton() {
    const cardWidth = this.width;
    return `
      <div class="skeleton-card" style="width: ${cardWidth};">
        <div class="skeleton-item skeleton-rectangular skeleton-${this.animation}" style="height: 200px; border-radius: var(--radius-xl) var(--radius-xl) 0 0;"></div>
        <div class="p-4 space-y-3">
          <div class="skeleton-item skeleton-text skeleton-${this.animation}" style="height: 24px; width: 60%;"></div>
          <div class="skeleton-item skeleton-text skeleton-${this.animation}" style="height: 16px; width: 100%;"></div>
          <div class="skeleton-item skeleton-text skeleton-${this.animation}" style="height: 16px; width: 80%;"></div>
          <div class="skeleton-item skeleton-text skeleton-${this.animation}" style="height: 16px; width: 40%;"></div>
        </div>
      </div>
    `;
  }

  setVariant(variant) {
    this.variant = variant;
    this.rebuild();
  }

  setCount(count) {
    this.count = count;
    this.rebuild();
  }

  setAnimation(animation) {
    this.animation = animation;
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

// Pre-built skeleton layouts
export const SkeletonLayouts = {
  // Dashboard cards
  dashboard: () => {
    const container = document.createElement('div');
    container.className = 'grid gap-6';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'card p-6 space-y-4';
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 20px; width: 120px;"></div>
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 14px; width: 80px;"></div>
        </div>
        <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 48px; width: 100%; font-size: 2rem;"></div>
        <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 16px; width: 150px;"></div>
      `;
      container.appendChild(card);
    }
    return container;
  },

  // List items
  list: (count = 5) => {
    const container = document.createElement('div');
    container.className = 'space-y-4';
    
    for (let i = 0; i < count; i++) {
      const item = document.createElement('div');
      item.className = 'flex items-center gap-4 p-4 bg-card rounded-xl border border-border-light';
      item.innerHTML = `
        <div class="skeleton-item skeleton-avatar skeleton-pulse" style="width: 48px; height: 48px; border-radius: 50%;"></div>
        <div class="flex-1 space-y-2">
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 18px; width: 200px;"></div>
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 14px; width: 150px;"></div>
        </div>
        <div class="skeleton-item skeleton-button skeleton-pulse" style="width: 80px; height: 36px;"></div>
      `;
      container.appendChild(item);
    }
    return container;
  },

  // Table rows
  table: (rows = 5, cols = 4) => {
    const container = document.createElement('div');
    container.className = 'overflow-x-auto';
    
    const table = document.createElement('table');
    table.className = 'w-full';
    table.innerHTML = `
      <thead>
        <tr class="border-b border-border-light">
          ${Array.from({ length: cols }, () => '<th class="text-left p-4"><div class="skeleton-item skeleton-text skeleton-pulse" style="height: 14px; width: 100px;"></div></th>').join('')}
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: rows }, () => `
          <tr class="border-b border-border-light">
            ${Array.from({ length: cols }, () => '<td class="p-4"><div class="skeleton-item skeleton-text skeleton-pulse" style="height: 16px; width: 100%;"></div></td>').join('')}
          </tr>
        `).join('')}
      </tbody>
    `;
    
    container.appendChild(table);
    return container;
  },

  // Form skeleton
  form: (fields = 5) => {
    const container = document.createElement('div');
    container.className = 'space-y-6 max-w-md';
    
    for (let i = 0; i < fields; i++) {
      const field = document.createElement('div');
      field.className = 'space-y-2';
      field.innerHTML = `
        <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 14px; width: 100px;"></div>
        <div class="skeleton-item skeleton-input skeleton-pulse" style="height: 44px; width: 100%;"></div>
      `;
      container.appendChild(field);
    }
    
    // Submit button
    const button = document.createElement('div');
    button.className = 'skeleton-item skeleton-button skeleton-pulse';
    button.style.width = '100%';
    button.style.height = '48px';
    container.appendChild(button);
    
    return container;
  },

  // Video player skeleton
  videoPlayer: () => {
    const container = document.createElement('div');
    container.className = 'space-y-4';
    container.innerHTML = `
      <div class="skeleton-item skeleton-rectangular skeleton-pulse" style="aspect-ratio: 16/9; border-radius: var(--radius-xl);"></div>
      <div class="flex items-center justify-between">
        <div class="space-y-2">
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 24px; width: 300px;"></div>
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 16px; width: 200px;"></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="skeleton-item skeleton-button skeleton-pulse" style="width: 40px; height: 40px; border-radius: 50%;"></div>
          <div class="skeleton-item skeleton-button skeleton-pulse" style="width: 40px; height: 40px; border-radius: 50%;"></div>
        </div>
      </div>
      <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 8px; width: 100%; border-radius: var(--radius-full);"></div>
    `;
    return container;
  },

  // Sidebar navigation skeleton
  sidebar: () => {
    const container = document.createElement('div');
    container.className = 'space-y-2 p-4';
    
    // Logo area
    const logo = document.createElement('div');
    logo.className = 'flex items-center gap-3 mb-6';
    logo.innerHTML = `
      <div class="skeleton-item skeleton-avatar skeleton-pulse" style="width: 32px; height: 32px;"></div>
      <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 20px; width: 100px;"></div>
    `;
    container.appendChild(logo);
    
    // Nav sections
    for (let s = 0; s < 3; s++) {
      const section = document.createElement('div');
      section.className = 'space-y-1';
      section.innerHTML = `
        <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 12px; width: 80px; margin-bottom: 8px;"></div>
        ${Array.from({ length: 4 }, () => `
          <div class="skeleton-item skeleton-text skeleton-pulse" style="height: 20px; width: 150px; border-radius: var(--radius-lg);"></div>
        `).join('')}
      `;
      container.appendChild(section);
    }
    
    return container;
  }
};