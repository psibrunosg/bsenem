// src/components/Flashcard.js
export class Flashcard {
  constructor(options = {}) {
    this.card = options.card ?? null;
    this.isFlipped = options.isFlipped ?? false;
    this.isAnimating = false;
    
    this.onFlip = options.onFlip ?? (() => {});
    this.onRating = options.onRating ?? (() => {});
    
    this.element = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = `flashcard ${this.isFlipped ? 'flipped' : ''}`;
    this.element.tabIndex = 0;
    
    this.element.innerHTML = `
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flashcard-header">
            <span class="flashcard-subject">${this.card?.subject || ''}</span>
            <button class="flashcard-flip-btn" aria-label="Virar card" data-action="flip">
              <i data-lucide="rotate-cw" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="flashcard-content">
            <p class="flashcard-text">${this.card?.front || 'Frente do card'}</p>
          </div>
          <div class="flashcard-footer">
            <span class="flashcard-hint">Toque para virar</span>
          </div>
        </div>
        
        <div class="flashcard-back">
          <div class="flashcard-header">
            <span class="flashcard-subject">${this.card?.subject || ''}</span>
            <button class="flashcard-flip-btn" aria-label="Voltar" data-action="flip">
              <i data-lucide="rotate-ccw" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="flashcard-content">
            <p class="flashcard-text">${this.card?.back || 'Verso do card'}</p>
          </div>
          <div class="flashcard-controls">
            <button class="flashcard-rating-btn again" data-rating="0" title="Novamente (1)">
              <i data-lucide="x" class="w-5 h-5"></i>
              <span>Novamente</span>
            </button>
            <button class="flashcard-rating-btn hard" data-rating="1" title="Difícil (2)">
              <i data-lucide="frown" class="w-5 h-5"></i>
              <span>Difícil</span>
            </button>
            <button class="flashcard-rating-btn good" data-rating="2" title="Bom (3)">
              <i data-lucide="smile" class="w-5 h-5"></i>
              <span>Bom</span>
            </button>
            <button class="flashcard-rating-btn easy" data-rating="3" title="Fácil (4)">
              <i data-lucide="grin" class="w-5 h-5"></i>
              <span>Fácil</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  bindEvents() {
    // Click to flip
    this.element.addEventListener('click', (e) => {
      if (e.target.closest('[data-rating]')) return;
      
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'flip' || !e.target.closest('.flashcard-controls')) {
        this.flip();
      }
    });

    // Rating buttons
    this.element.addEventListener('click', (e) => {
      const ratingBtn = e.target.closest('[data-rating]');
      if (ratingBtn) {
        const rating = parseInt(ratingBtn.dataset.rating);
        this.onRating(rating);
      }
    });

    // Keyboard
    this.element.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.flip();
          break;
        case '1':
          if (this.isFlipped) this.onRating(0);
          break;
        case '2':
          if (this.isFlipped) this.onRating(1);
          break;
        case '3':
          if (this.isFlipped) this.onRating(2);
          break;
        case '4':
          if (this.isFlipped) this.onRating(3);
          break;
      }
    });
  }

  flip() {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.isFlipped = !this.isFlipped;
    
    this.element.classList.toggle('flipped', this.isFlipped);
    
    setTimeout(() => {
      this.isAnimating = false;
    }, 600);
    
    this.onFlip(this.isFlipped);
  }

  setCard(card) {
    this.card = card;
    this.isFlipped = false;
    this.element?.classList.remove('flipped');
    
    // Update content
    const frontText = this.element?.querySelector('.flashcard-front .flashcard-text');
    const backText = this.element?.querySelector('.flashcard-back .flashcard-text');
    const subjectEls = this.element?.querySelectorAll('.flashcard-subject');
    
    if (frontText) frontText.textContent = card.front;
    if (backText) backText.textContent = card.back;
    subjectEls?.forEach(el => el.textContent = card.subject || '');
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
