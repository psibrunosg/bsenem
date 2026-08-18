// src/components/XPBar.js
export class XPBar {
  constructor(options = {}) {
    this.currentXP = options.currentXP ?? 0;
    this.maxXP = options.maxXP ?? 1000;
    this.level = options.level ?? 1;
    this.animated = options.animated ?? true;
    
    this.onLevelUp = options.onLevelUp ?? (() => {});
    
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'xp-bar';
    
    const percent = Math.min(100, (this.currentXP / this.maxXP) * 100);
    const nextLevelXP = this.maxXP;
    const currentLevelXP = this.currentXP % this.maxXP;

    this.element.innerHTML = `
      <div class="xp-bar-header">
        <div class="xp-bar-level">
          <span class="xp-level-badge">Nv. ${this.level}</span>
        </div>
        <div class="xp-bar-info">
          <span class="xp-bar-text">
            <span class="xp-current">${currentLevelXP}</span> / ${nextLevelXP} XP
          </span>
          <span class="xp-bar-percent">${Math.round(percent)}%</span>
        </div>
      </div>
      
      <div class="xp-bar-track">
        <div class="xp-bar-fill ${this.animated ? 'animated' : ''}" style="width: ${percent}%"></div>
        <div class="xp-bar-glow"></div>
      </div>
      
      <div class="xp-bar-footer">
        <span class="xp-bar-next">Próximo nível: Nv. ${this.level + 1}</span>
        <span class="xp-bar-remaining">${nextLevelXP - currentLevelXP} XP restante</span>
      </div>
    `;

    return this.element;
  }

  setXP(xp) {
    const oldLevel = this.level;
    this.currentXP = xp;
    this.level = Math.floor(xp / this.maxXP) + 1;
    
    if (this.level > oldLevel && oldLevel > 0) {
      this.onLevelUp(this.level);
      this.showLevelUpAnimation();
    }
    
    this.updateUI();
  }

  updateUI() {
    const percent = Math.min(100, (this.currentXP / this.maxXP) * 100);
    const currentLevelXP = this.currentXP % this.maxXP;
    
    const fill = this.element?.querySelector('.xp-bar-fill');
    const current = this.element?.querySelector('.xp-current');
    const levelBadge = this.element?.querySelector('.xp-level-badge');
    const remaining = this.element?.querySelector('.xp-bar-remaining');
    const nextLevel = this.element?.querySelector('.xp-bar-next');
    
    if (fill) fill.style.width = `${percent}%`;
    if (current) current.textContent = currentLevelXP;
    if (levelBadge) levelBadge.textContent = `Nv. ${this.level}`;
    if (remaining) remaining.textContent = `${this.maxXP - currentLevelXP} XP restante`;
    if (nextLevel) nextLevel.textContent = `Próximo nível: Nv. ${this.level + 1}`;
  }

  showLevelUpAnimation() {
    const badge = this.element?.querySelector('.xp-level-badge');
    if (badge) {
      badge.classList.add('level-up');
      setTimeout(() => badge.classList.remove('level-up'), 1000);
    }
    
    // Show level up toast
    const toast = document.createElement('div');
    toast.className = 'toast toast-achievement';
    toast.innerHTML = `
      <div class="toast-icon">🎉</div>
      <div class="toast-content">
        <strong>Parabéns!</strong>
        <p>Você subiu para o nível ${this.level}!</p>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  addXP(amount) {
    this.setXP(this.currentXP + amount);
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
