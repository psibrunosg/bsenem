// src/tests/SRSEngine.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { SRSEngine } from '../utils/SRSEngine.js';

describe('SRSEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SRSEngine('test_srs_' + Date.now());
    engine.reset();
  });

  describe('createCard', () => {
    it('should create a new card with default values', () => {
      const card = engine.createCard('front', 'back');
      
      expect(card.id).toBeDefined();
      expect(card.front).toBe('front');
      expect(card.back).toBe('back');
      expect(card.interval).toBe(0);
      expect(card.repetitions).toBe(0);
      expect(card.easeFactor).toBe(2.5);
    });

    it('should add card to cards array', () => {
      engine.createCard('front1', 'back1');
      engine.createCard('front2', 'back2');
      expect(engine.getAllCards()).toHaveLength(2);
    });

    it('should accept optional fields', () => {
      const card = engine.createCard('front', 'back', {
        subject: 'Math',
        tags: ['algebra']
      });
      expect(card.subject).toBe('Math');
      expect(card.tags).toContain('algebra');
    });
  });

  describe('review', () => {
    let cardId;

    beforeEach(() => {
      const card = engine.createCard('front', 'back');
      cardId = card.id;
    });

    it('should reset repetitions on quality 0 (Again)', () => {
      engine.review(cardId, 0);
      const card = engine.getCard(cardId);
      expect(card.repetitions).toBe(0);
      expect(card.interval).toBe(1);
    });

    it('should increase interval on quality 2 (Good)', () => {
      engine.review(cardId, 2);
      const card = engine.getCard(cardId);
      expect(card.repetitions).toBe(1);
      expect(card.interval).toBe(1);
    });

    it('should increase interval more on consecutive good reviews', () => {
      engine.review(cardId, 2);
      engine.review(cardId, 2);
      const card = engine.getCard(cardId);
      expect(card.repetitions).toBe(2);
      expect(card.interval).toBe(6);
    });

    it('should update ease factor', () => {
      const initialEF = engine.getCard(cardId).easeFactor;
      engine.review(cardId, 3);
      expect(engine.getCard(cardId).easeFactor).not.toBe(initialEF);
    });

    it('should not let ease factor go below 1.3', () => {
      for (let i = 0; i < 10; i++) {
        engine.review(cardId, 0);
      }
      expect(engine.getCard(cardId).easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('should increment totalReviews', () => {
      engine.review(cardId, 2);
      expect(engine.getCard(cardId).totalReviews).toBe(1);
    });

    it('should increment correctReviews for quality >= 1', () => {
      engine.review(cardId, 2);
      expect(engine.getCard(cardId).correctReviews).toBe(1);
    });

    it('should return null for invalid card', () => {
      expect(engine.review('invalid', 2)).toBeNull();
    });
  });

  describe('getDueCards', () => {
    it('should return cards that are due for review', () => {
      const card1 = engine.createCard('front1', 'back1');
      const card2 = engine.createCard('front2', 'back2');
      
      // Set card1 due date to past
      engine.updateCard(card1.id, { dueDate: new Date(Date.now() - 86400000).toISOString() });
      // Set card2 due date to future
      engine.updateCard(card2.id, { dueDate: new Date(Date.now() + 86400000).toISOString() });
      
      const dueCards = engine.getDueCards();
      expect(dueCards).toHaveLength(1);
      expect(dueCards[0].id).toBe(card1.id);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      engine.createCard('front1', 'back1');
      engine.createCard('front2', 'back2');
      engine.createCard('front3', 'back3');
      
      // Review one card
      const cards = engine.getAllCards();
      engine.review(cards[0].id, 2);
      
      const stats = engine.getStats();
      expect(stats.total).toBe(3);
      expect(stats.totalReviews).toBe(1);
      expect(stats.correctReviews).toBe(1);
    });
  });

  describe('deleteCard', () => {
    it('should remove card from array', () => {
      const card = engine.createCard('front', 'back');
      expect(engine.getAllCards()).toHaveLength(1);
      engine.deleteCard(card.id);
      expect(engine.getAllCards()).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('should save and load cards from localStorage', () => {
      const key = 'test_persist_' + Date.now();
      const engine1 = new SRSEngine(key);
      engine1.createCard('front', 'back');
      
      const engine2 = new SRSEngine(key);
      expect(engine2.getAllCards()).toHaveLength(1);
    });
  });

  describe('exportCards', () => {
    it('should return JSON string of all cards', () => {
      engine.createCard('front', 'back');
      const exported = engine.exportCards();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
    });
  });
});
