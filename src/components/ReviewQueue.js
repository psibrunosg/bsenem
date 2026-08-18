// src/components/ReviewQueue.js
import { Flashcard } from './Flashcard.js';

export class ReviewQueue {
  constructor(options = {}) {
    this.cards = options.cards ?? [];
    this.currentIndex = 0;
    this.isComplete = false;
    
    this.onComplete = options.onComplete ?? (() => {});
    this.onProgress = options.onProgress ?? (() => {});
    this.onRating = options.onRating ?? (() => {});
    
    this.element = null;
    this.flashcard = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'review-queue';
    
    if (this.cards.length === 0) {
      return this.renderEmpty();
    }

    this.element.innerHTML = `
      <div class="review-header">
        <div class="review-progress-info">
          <span class="review-current">${this.currentIndex + 1}</span>
          <span class="review-separator">de</span>
          <span class="review-total">${this.cards.length}</span>
        </div>
        <div class="review-progress-bar">
          <div class="review-progress-fill" style="width: ${this.getProgressPercent()}%"></div>
        </div>
        <div class="review-stats">
          <span class="review-stat">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span class="review-correct">0</span>
          </span>
          <span class="review-stat">
            <i data-lucide="x-circle" class="w-4 h-4"></i>
            <span class="review-incorrect">0</span>
          </span>
        </div>
      </div>
      
      <div class="review-card-container"></div>
      
      <div class="review-footer">
        <button class="review-skip-btn" data-action="skip">
          Pular
        </button>
        <div class="review-keyboard-hints">
          <span><kbd>Espaço</kbd> Virar</span>
          <span><kbd>1-4</kbd> Avaliar</span>
        </div>
      </div>
    `;

    this.renderCurrentCard();
    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  renderEmpty() {
    this.element.innerHTML = `
      <div class="review-empty">
        <i data-lucide="check-circle" class="w-16 h-16"></i>
        <h3>Nenhum card para revisar</h3>
        <p>Adicione flashcards ou volte mais tarde quando houver cards disponíveis.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  renderCurrentCard() {
    if (this.currentIndex >= this.cards.length) {
      this.complete();
      return;
    }

    const container = this.element.querySelector('.review-card-container');
    if (!container) return;

    // Remove old flashcard
    if (this.flashcard) {
      this.flashcard.destroy();
    }

    const card = this.cards[this.currentIndex];
    
    this.flashcard = new Flashcard({
      card,
      onFlip: (isFlipped) => this.onCardFlip(isFlipped),
      onRating: (rating) => this.handleRating(rating)
    });

    container.innerHTML = '';
    container.appendChild(this.flashcard.render());
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'skip') {
        this.skip();
      }
    });
  }

  handleRating(rating) {
    const card = this.cards[this.currentIndex];
    if (!card) return;

    this.onRating(card.id, rating);

    // Update stats
    const correctEl = this.element.querySelector('.review-correct');
    const incorrectEl = this.element.querySelector('.review-incorrect');
    
    if (rating >= 2) {
      correctEl.textContent = parseInt(correctEl.textContent) + 1;
    } else {
      incorrectEl.textContent = parseInt(incorrectEl.textContent) + 1;
    }

    // Next card
    this.currentIndex++;
    this.updateProgress();
    this.renderCurrentCard();
  }

  skip() {
    this.currentIndex++;
    this.updateProgress();
    this.renderCurrentCard();
  }

  updateProgress() {
    const currentEl = this.element.querySelector('.review-current');
    const fillEl = this.element.querySelector('.review-progress-fill');
    
    if (currentEl) currentEl.textContent = Math.min(this.currentIndex + 1, this.cards.length);
    if (fillEl) fillEl.style.width = `${this.getProgressPercent()}%`;
    
    this.onProgress(this.currentIndex, this.cards.length);
  }

  getProgressPercent() {
    return this.cards.length > 0 
      ? (this.currentIndex / this.cards.length) * 100 
      : 0;
  }

  complete() {
    this.isComplete = true;
    
    const container = this.element.querySelector('.review-card-container');
    if (container) {
      container.innerHTML = `
        <div class="review-complete">
          <div class="review-complete-icon">
            <i data-lucide="party-popper" class="w-16 h-16"></i>
          </div>
          <h3>Revisão completa!</h3>
          <p>Você revisou todos os cards.</p>
          <button class="btn btn-primary" data-action="restart">
            Revisar novamente
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons(container);
    }

    this.onComplete();
  }

  setCards(cards) {
    this.cards = cards;
    this.currentIndex = 0;
    this.isComplete = false;
    this.renderCurrentCard();
    this.updateProgress();
  }

  destroy() {
    this.flashcard?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
