// src/utils/SRSEngine.js - Spaced Repetition System (SM-2 Algorithm)

export class SRSEngine {
  constructor(storageKey = 'bsenem_srs') {
    this.storageKey = storageKey;
    this.cards = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cards));
  }

  createCard(front, back, options = {}) {
    const card = {
      id: options.id || this.generateId(),
      front,
      back,
      subject: options.subject || '',
      tags: options.tags || [],
      media: options.media || null,
      
      // SM-2 fields
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: new Date().toISOString(),
      lastReview: null,
      
      // Stats
      totalReviews: 0,
      correctReviews: 0,
      streak: 0,
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.cards.push(card);
    this.save();
    return card;
  }

  updateCard(cardId, updates) {
    const index = this.cards.findIndex(c => c.id === cardId);
    if (index === -1) return null;

    this.cards[index] = {
      ...this.cards[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.cards[index];
  }

  deleteCard(cardId) {
    this.cards = this.cards.filter(c => c.id !== cardId);
    this.save();
  }

  getCard(cardId) {
    return this.cards.find(c => c.id === cardId) || null;
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
  review(cardId, quality) {
    // quality: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
    const card = this.getCard(cardId);
    if (!card) return null;

    const now = new Date();
    const lastReview = card.lastReview ? new Date(card.lastReview) : null;
    
    // Update review count
    card.totalReviews++;
    card.lastReview = now.toISOString();

    // SM-2 algorithm
    if (quality < 1) {
      // Failed - reset
      card.repetitions = 0;
      card.interval = 1;
      card.streak = 0;
    } else {
      // Passed
      card.correctReviews++;
      card.streak++;

      if (card.repetitions === 0) {
        card.interval = 1;
      } else if (card.repetitions === 1) {
        card.interval = 6;
      } else {
        card.interval = Math.round(card.interval * card.easeFactor);
      }
      card.repetitions++;
    }

    // Update ease factor
    // EF' = EF + (0.1 - (3 - q) * (0.08 + (3 - q) * 0.02))
    card.easeFactor = Math.max(1.3, 
      card.easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
    );

    // Adjust interval based on quality
    if (quality === 1) {
      card.interval = Math.max(1, Math.round(card.interval * 0.8));
    } else if (quality === 3) {
      card.interval = Math.round(card.interval * 1.3);
    }

    // Set due date
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + card.interval);
    card.dueDate = dueDate.toISOString();

    card.updatedAt = now.toISOString();
    this.save();

    return card;
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
