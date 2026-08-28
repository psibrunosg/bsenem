// src/utils/SRSEngine.js - Spaced Repetition System (SM-2 Algorithm)

import { api } from './api.js';

export class SRSEngine {
  constructor() {
    this.cards = [];
  }

  async init() {
    try {
      const res = await api.get('/flashcards?per_page=1000');
      if (res.success) {
        this.cards = res.data.data; // paginated data
      }
    } catch (e) {
      console.error('Failed to load flashcards', e);
    }
  }

  async createCard(front, back, options = {}) {
    const res = await api.post('/flashcards', {
      front,
      back,
      subject_id: options.subject || null,
      tags: options.tags || [],
      media_url: options.media || null
    });
    
    if (res.success) {
      this.cards.push(res.data);
      return res.data;
    }
    return null;
  }

  async updateCard(cardId, updates) {
    const res = await api.put(\`/flashcards/\${cardId}\`, updates);
    if (res.success) {
      const index = this.cards.findIndex(c => c.id == cardId);
      if (index !== -1) {
        this.cards[index] = res.data;
      }
      return res.data;
    }
    return null;
  }

  async deleteCard(cardId) {
    const res = await api.delete(\`/flashcards/\${cardId}\`);
    if (res.success) {
      this.cards = this.cards.filter(c => c.id != cardId);
    }
  }

  getCard(cardId) {
    return this.cards.find(c => c.id == cardId) || null;
  }

  getAllCards() {
    return [...this.cards];
  }

  getCardsBySubject(subject) {
    return this.cards.filter(c => c.subject === subject);
  }

  getCardsByTag(tag) {
    return this.cards.filter(c => c.tags.includes(tag));
  }

  // SM-2 Algorithm implementation
  async review(cardId, quality) {
    // quality: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
    const res = await api.put(\`/flashcards/\${cardId}/review\`, { quality });
    
    if (res.success && res.data.card) {
      // Update local card
      const index = this.cards.findIndex(c => c.id == cardId);
      if (index !== -1) {
        this.cards[index] = res.data.card;
      }
      return res.data;
    }
    return null;
  }

  getDueCards(limit = 20) {
    const now = new Date();
    return this.cards
      .filter(card => new Date(card.dueDate) <= now)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, limit);
  }

  getNewCards(limit = 20) {
    return this.cards
      .filter(card => card.repetitions === 0)
      .slice(0, limit);
  }

  getStats() {
    const now = new Date();
    const total = this.cards.length;
    const due = this.cards.filter(c => new Date(c.dueDate) <= now).length;
    const newCards = this.cards.filter(c => c.repetitions === 0).length;
    const learning = this.cards.filter(c => c.repetitions > 0 && c.interval < 21).length;
    const mature = this.cards.filter(c => c.interval >= 21).length;

    const totalReviews = this.cards.reduce((sum, c) => sum + c.totalReviews, 0);
    const correctReviews = this.cards.reduce((sum, c) => sum + c.correctReviews, 0);
    const retention = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : 0;

    return {
      total,
      due,
      new: newCards,
      learning,
      mature,
      retention: Math.round(retention),
      totalReviews,
      correctReviews
    };
  }

  getSubjectStats() {
    const subjects = {};
    
    this.cards.forEach(card => {
      if (!card.subject) return;
      
      if (!subjects[card.subject]) {
        subjects[card.subject] = {
          total: 0,
          due: 0,
          mastered: 0
        };
      }
      
      subjects[card.subject].total++;
      
      const now = new Date();
      if (new Date(card.dueDate) <= now) {
        subjects[card.subject].due++;
      }
      
      if (card.interval >= 21) {
        subjects[card.subject].mastered++;
      }
    });

    return subjects;
  }

  generateId() {
    return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  importCards(cards) {
    cards.forEach(card => {
      const existing = this.cards.find(c => c.id === card.id);
      if (!existing) {
        this.cards.push(card);
      }
    });
    this.save();
  }

  exportCards() {
    return JSON.stringify(this.cards, null, 2);
  }

  reset() {
    this.cards = [];
    this.save();
  }
}

// Singleton instance
export const srsEngine = new SRSEngine();
