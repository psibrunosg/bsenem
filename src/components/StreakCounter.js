// src/components/StreakCounter.js
export class StreakCounter {
  constructor(options = {}) {
    this.streak = options.streak ?? 0;
    this.bestStreak = options.bestStreak ?? 0;
    this.freezes = options.freezes ?? 0;
    this.hasStudiedToday = options.hasStudiedToday ?? false;
    
    this.onFreeze = options.onFreeze ?? (() => {});
    
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'streak-counter';
    
    const streakClass = this.streak >= 7 ? 'hot' : this.streak >= 3 ? 'warm' : 'cold';

    this.element.innerHTML = `
      <div class="streak-main">
        <div class="streak-fire ${streakClass} ${this.hasStudiedToday ? 'active' : ''}">
          <span class="streak-fire-emoji">${this.getFireEmoji()}</span>
          ${this.streak > 0 ? '<div class="streak-fire-particles"></div>' : ''}
        </div>
        <div class="streak-info">
          <span class="streak-count">${this.streak}</span>
          <span class="streak-label">${this.streak === 1 ? 'dia' : 'dias'}</span>
        </div>
      </div>
      
      <div class="streak-details">
        <div class="streak-detail">
          <i data-lucide="trophy" class="w-4 h-4"></i>
          <span>Recorde: ${this.bestStreak} dias</span>
        </div>
        <div class="streak-detail">
          <i data-lucide="snowflake" class="w-4 h-4"></i>
          <span>Congelamentos: ${this.freezes}</span>
        </div>
      </div>
      
      <div class="streak-status">
        ${this.hasStudiedToday ? `
          <span class="streak-today done">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            Hoje completo!
          </span>
        ` : `
          <span class="streak-today pending">
            <i data-lucide="circle" class="w-4 h-4"></i>
            Estude hoje para manter a sequência
          </span>
        `}
      </div>
      
      ${this.streak >= 3 && this.freezes > 0 ? `
        <button class="streak-freeze-btn" data-action="freeze">
          <i data-lucide="snowflake" class="w-4 h-4"></i>
          Usar congelamento
        </button>
      ` : ''}
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  getFireEmoji() {
    if (this.streak >= 30) return '🔥🔥🔥';
    if (this.streak >= 14) return '🔥🔥';
    if (this.streak >= 1) return '🔥';
    return '❄️';
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'freeze') {
        this.useFreeze();
      }
    });
  }

  useFreeze() {
    if (this.freezes <= 0) return;
    
    this.freezes--;
    this.onFreeze();
    this.updateUI();
  }

  incrementStreak() {
    this.streak++;
    if (this.streak > this.bestStreak) {
      this.bestStreak = this.streak;
    }
    this.hasStudiedToday = true;
    this.updateUI();
  }

  resetStreak() {
    this.streak = 0;
    this.hasStudiedToday = false;
    this.updateUI();
  }

  updateUI() {
    const newElement = this.render();
    this.element.replaceWith(newElement);
    this.element = newElement;
  }

  setStreak(streak, bestStreak, freezes, hasStudiedToday) {
    this.streak = streak;
    this.bestStreak = bestStreak ?? this.bestStreak;
    this.freezes = freezes ?? this.freezes;
    this.hasStudiedToday = hasStudiedToday ?? this.hasStudiedToday;
    this.updateUI();
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
