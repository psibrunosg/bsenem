import { FlashcardManager } from '@components/FlashcardManager.js';
import { ReviewQueue } from '@components/ReviewQueue.js';
import { api as defaultApi } from '@utils/api.js';

export class FlashcardsPage {
  constructor({ subjects = [], apiClient = defaultApi } = {}) {
    this.subjects = subjects;
    this.api = apiClient;
    this.cards = [];
    this.element = null;
    this.manager = null;
    this.reviewQueue = null;
    this.status = '';
  }

  async render() {
    this.element = document.createElement('section');
    this.element.className = 'flashcards-page';
    this.element.addEventListener('click', (event) => this.handleClick(event));
    await this.loadCards();
    this.renderManager();
    return this.element;
  }

  async loadCards() {
    try {
      const response = await this.api.get('/flashcards?per_page=500');
      this.cards = response?.success && Array.isArray(response.data) ? response.data.map(normalizeCard) : [];
      this.status = response?.success ? '' : 'Não foi possível carregar seus flashcards agora.';
    } catch {
      this.cards = [];
      this.status = 'Não foi possível carregar seus flashcards agora.';
    }
  }

  renderManager() {
    this.reviewQueue?.destroy();
    this.reviewQueue = null;
    this.manager?.destroy();
    this.manager = new FlashcardManager({
      cards: this.cards,
      subjects: this.subjects,
      onSave: (card) => { void this.saveCard(card); },
      onDelete: (id) => { void this.deleteCard(id); },
      onImport: (cards) => { void this.importCards(cards); },
      onExport: (cards) => this.exportCards(cards)
    });
    this.element.replaceChildren(this.renderHeader(), this.manager.render());
  }

  renderHeader() {
    const header = document.createElement('header');
    header.className = 'page-header';
    const title = document.createElement('h1');
    title.textContent = 'Flashcards';
    const description = document.createElement('p');
    description.textContent = 'Pratique recuperação ativa e revise apenas os cards que já venceram.';
    const review = document.createElement('button');
    review.type = 'button';
    review.className = 'btn btn-primary';
    review.dataset.action = 'start-review';
    const due = this.dueCards();
    review.disabled = due.length === 0;
    review.textContent = due.length ? `Revisar ${due.length} agora` : 'Nenhum card para revisar';
    const status = document.createElement('p');
    status.className = 'flashcards-page-status';
    status.role = 'status';
    status.textContent = this.status;
    header.append(title, description, review, status);
    return header;
  }

  handleClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'start-review') this.startReview();
    if (action === 'back-to-cards') this.renderManager();
  }

  startReview() {
    const due = this.dueCards();
    if (!due.length) return;
    this.manager?.destroy();
    this.manager = null;
    this.reviewQueue = new ReviewQueue({
      cards: due,
      onRating: (cardId, quality) => this.recordReview(cardId, quality),
      onComplete: () => { this.status = 'Revisão concluída.'; }
    });
    const header = this.renderHeader();
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-secondary';
    back.dataset.action = 'back-to-cards';
    back.textContent = 'Voltar aos cards';
    header.append(back);
    this.element.replaceChildren(header, this.reviewQueue.render());
  }

  dueCards() {
    const now = Date.now();
    return this.cards.filter((card) => !card.due_date || Date.parse(card.due_date.replace(' ', 'T')) <= now);
  }

  async saveCard(card) {
    const payload = { front: card.front, back: card.back, subject_id: card.subject || null, tags: card.tags || [] };
    try {
      const response = card.id ? await this.api.put(`/flashcards/${card.id}`, payload) : await this.api.post('/flashcards', payload);
      this.status = response?.success ? 'Flashcard salvo.' : 'Não foi possível salvar o flashcard.';
    } catch {
      this.status = 'Não foi possível salvar o flashcard.';
    }
    await this.loadCards();
    this.renderManager();
  }

  async deleteCard(id) {
    try {
      const response = await this.api.delete(`/flashcards/${id}`);
      this.status = response?.success ? 'Flashcard removido.' : 'Não foi possível remover o flashcard.';
    } catch {
      this.status = 'Não foi possível remover o flashcard.';
    }
    await this.loadCards();
    this.renderManager();
  }

  async recordReview(cardId, quality) {
    try {
      const response = await this.api.post(`/flashcards/${cardId}/review`, { quality });
      if (!response?.success) {
        this.status = 'A avaliação não foi registrada. Tente novamente.';
        return false;
      }
      return true;
    } catch {
      this.status = 'A avaliação não foi registrada. Tente novamente.';
      return false;
    }
  }

  async importCards(cards) {
    if (!Array.isArray(cards)) return;
    for (const card of cards) {
      if (!card?.front?.trim() || !card?.back?.trim()) continue;
      await this.api.post('/flashcards', { front: card.front.trim(), back: card.back.trim(), tags: Array.isArray(card.tags) ? card.tags : [] });
    }
    await this.loadCards();
    this.renderManager();
  }

  exportCards(cards) {
    const blob = new Blob([JSON.stringify(cards.map(({ front, back, tags }) => ({ front, back, tags })), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'flashcards-bs-estudos.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  destroy() {
    this.manager?.destroy();
    this.reviewQueue?.destroy();
    this.element?.remove();
  }
}

function normalizeCard(card) {
  return {
    ...card,
    subject: String(card.subject_id ?? ''),
    interval: Number(card.interval ?? 0),
    easeFactor: Number(card.ease_factor ?? card.easeFactor ?? 2.5)
  };
}
