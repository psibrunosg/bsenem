import { api } from '@utils/api.js';

export class FlashcardsPage {
  constructor({ subjects = [] } = {}) {
    this.subjects = subjects;
    this.cards = [];
    this.element = null;
  }

  async render() {
    const response = await api.get('/flashcards?per_page=100').catch(() => ({ success: false }));
    this.cards = response?.success ? (response.data ?? []) : [];
    this.element = document.createElement('div');
    this.element.className = 'flashcards-page';
    this.element.innerHTML = `<div class="page-header"><h1>Flashcards</h1><p>Revise seus flashcards com repetição espaçada</p></div><div class="flashcards-content">${this.cards.length ? `<p>${this.cards.length} flashcard(s) disponível(is).</p>` : '<p>Nenhum flashcard ainda. Crie o primeiro para começar.</p>'}</div>`;
    return this.element;
  }

  destroy() { this.element?.remove(); }
}
