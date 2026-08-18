// src/pages/FlashcardsPage.js
import { ReviewQueue } from '@components/ReviewQueue.js';
import { FlashcardManager } from '@components/FlashcardManager.js';
import { srsEngine } from '@utils/SRSEngine.js';

export class FlashcardsPage {
  constructor(options = {}) {
    this.app = options.app;
    this.subjects = options.subjects ?? [];
    this.currentView = 'review'; // 'review' | 'manage'
    
    this.reviewQueue = null;
    this.manager = null;
    this.element = null;
    
    this.initSampleCards();
  }

  initSampleCards() {
    const existingCards = srsEngine.getAllCards();
    if (existingCards.length > 0) return;

    // Add sample cards
    const sampleCards = [
      {
        front: 'O que é uma função quadrática?',
        back: 'Uma função do tipo f(x) = ax² + bx + c, onde a ≠ 0. Seu gráfico é uma parábola.',
        subject: 'math'
      },
      {
        front: 'Quais são as Raízes da Equação de 2º Grau?',
        back: 'x = (-b ± √(b² - 4ac)) / 2a, conhecida como Fórmula de Bhaskara.',
        subject: 'math'
      },
      {
        front: 'O que é o Sistema Nervoso Central?',
        back: 'Composto pelo encéfalo (cérebro, cerebelo, tronco encefálico) e pela medula espinhal.',
        subject: 'biology'
      },
      {
        front: 'Quais são as Leis de Newton?',
        back: '1ª Inércia, 2ª F = ma, 3ª Ação e reação.',
        subject: 'physics'
      },
      {
        front: 'O que foi o Descobrimento do Brasil?',
        back: 'Chegada dos portugueses em 22 de abril de 1500, liderada por Pedro Álvares Cabral.',
        subject: 'history'
      }
    ];

    sampleCards.forEach(card => {
      srsEngine.createCard(card.front, card.back, { subject: card.subject });
    });
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'flashcards-page';
    
    this.element.innerHTML = `
      <div class="page-header">
        <h1>Flashcards</h1>
        <p>Revise seus flashcards com repetição espaçada</p>
      </div>
      
      <div class="flashcards-tabs">
        <button class="flashcards-tab active" data-view="review">
          <i data-lucide="layers" class="w-5 h-5"></i>
          Revisar
        </button>
        <button class="flashcards-tab" data-view="manage">
          <i data-lucide="settings" class="w-5 h-5"></i>
          Gerenciar
        </button>
      </div>
      
      <div class="flashcards-stats">
        <div class="flashcard-stat">
          <span class="flashcard-stat-value" data-stat="due">0</span>
          <span class="flashcard-stat-label">Para revisar</span>
        </div>
        <div class="flashcard-stat">
          <span class="flashcard-stat-value" data-stat="new">0</span>
          <span class="flashcard-stat-label">Novos</span>
        </div>
        <div class="flashcard-stat">
          <span class="flashcard-stat-value" data-stat="learning">0</span>
          <span class="flashcard-stat-label">Aprendendo</span>
        </div>
        <div class="flashcard-stat">
          <span class="flashcard-stat-value" data-stat="mature">0</span>
          <span class="flashcard-stat-label">Dominados</span>
        </div>
      </div>
      
      <div class="flashcards-content">
        <div class="flashcards-review-container"></div>
        <div class="flashcards-manager-container" style="display: none;"></div>
      </div>
    `;

    this.initComponents();
    this.bindEvents();
    this.updateStats();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    return this.element;
  }

  initComponents() {
    // Review Queue
    const dueCards = srsEngine.getDueCards();
    const newCards = srsEngine.getNewCards(5);
    const reviewCards = [...dueCards, ...newCards].slice(0, 20);

    this.reviewQueue = new ReviewQueue({
      cards: reviewCards,
      onRating: (cardId, rating) => this.handleRating(cardId, rating),
      onComplete: () => this.handleReviewComplete()
    });

    const reviewContainer = this.element.querySelector('.flashcards-review-container');
    if (reviewContainer) {
      reviewContainer.appendChild(this.reviewQueue.render());
    }

    // Manager
    this.manager = new FlashcardManager({
      cards: srsEngine.getAllCards(),
      subjects: this.subjects,
      onSave: (card) => this.handleSaveCard(card),
      onDelete: (cardId) => this.handleDeleteCard(cardId),
      onExport: (cards) => this.handleExport(cards),
      onImport: (cards) => this.handleImport(cards)
    });

    const managerContainer = this.element.querySelector('.flashcards-manager-container');
    if (managerContainer) {
      managerContainer.appendChild(this.manager.render());
    }
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const tab = e.target.closest('.flashcards-tab');
      if (tab) {
        const view = tab.dataset.view;
        this.switchView(view);
      }
    });
  }

  switchView(view) {
    this.currentView = view;
    
    // Update tabs
    this.element.querySelectorAll('.flashcards-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });

    // Show/hide containers
    const reviewContainer = this.element.querySelector('.flashcards-review-container');
    const managerContainer = this.element.querySelector('.flashcards-manager-container');
    
    if (reviewContainer) reviewContainer.style.display = view === 'review' ? 'block' : 'none';
    if (managerContainer) managerContainer.style.display = view === 'manage' ? 'block' : 'none';
  }

  handleRating(cardId, rating) {
    srsEngine.review(cardId, rating);
    this.updateStats();
  }

  handleReviewComplete() {
    this.updateStats();
  }

  handleSaveCard(cardData) {
    if (cardData.id) {
      srsEngine.updateCard(cardData.id, cardData);
    } else {
      srsEngine.createCard(cardData.front, cardData.back, {
        subject: cardData.subject,
        tags: cardData.tags
      });
    }
    this.updateStats();
    this.manager.setCards(srsEngine.getAllCards());
  }

  handleDeleteCard(cardId) {
    srsEngine.deleteCard(cardId);
    this.updateStats();
    this.manager.setCards(srsEngine.getAllCards());
  }

  handleExport(cards) {
    const data = srsEngine.exportCards();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  handleImport(cards) {
    srsEngine.importCards(cards);
    this.updateStats();
    this.manager.setCards(srsEngine.getAllCards());
  }

  updateStats() {
    const stats = srsEngine.getStats();
    
    const dueEl = this.element.querySelector('[data-stat="due"]');
    const newEl = this.element.querySelector('[data-stat="new"]');
    const learningEl = this.element.querySelector('[data-stat="learning"]');
    const matureEl = this.element.querySelector('[data-stat="mature"]');
    
    if (dueEl) dueEl.textContent = stats.due;
    if (newEl) newEl.textContent = stats.new;
    if (learningEl) learningEl.textContent = stats.learning;
    if (matureEl) matureEl.textContent = stats.mature;
  }

  destroy() {
    this.reviewQueue?.destroy();
    this.manager?.destroy();
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
