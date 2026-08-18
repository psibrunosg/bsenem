// src/tests/StreakCounter.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { StreakCounter } from '../components/StreakCounter.js';

describe('StreakCounter', () => {
  let container;
  let streak;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    streak = new StreakCounter({
      streak: 5,
      bestStreak: 10,
      freezes: 2,
      hasStudiedToday: false
    });
  });

  describe('render', () => {
    it('should render the streak counter element', () => {
      const element = streak.render();
      expect(element).toBeDefined();
      expect(element.classList.contains('streak-counter')).toBe(true);
    });

    it('should display current streak', () => {
      const element = streak.render();
      const count = element.querySelector('.streak-count');
      expect(count.textContent).toBe('5');
    });

    it('should display correct streak label (plural)', () => {
      const element = streak.render();
      const label = element.querySelector('.streak-label');
      expect(label.textContent).toBe('dias');
    });

    it('should display correct streak label (singular)', () => {
      streak.streak = 1;
      const element = streak.render();
      const label = element.querySelector('.streak-label');
      expect(label.textContent).toBe('dia');
    });

    it('should display best streak', () => {
      const element = streak.render();
      const details = element.querySelector('.streak-details');
      expect(details.textContent).toContain('10');
    });

    it('should display freezes count', () => {
      const element = streak.render();
      const details = element.querySelector('.streak-details');
      expect(details.textContent).toContain('2');
    });

    it('should show pending status when not studied today', () => {
      const element = streak.render();
      const status = element.querySelector('.streak-today');
      expect(status.classList.contains('pending')).toBe(true);
    });

    it('should show done status when studied today', () => {
      streak.hasStudiedToday = true;
      const element = streak.render();
      const status = element.querySelector('.streak-today');
      expect(status.classList.contains('done')).toBe(true);
    });

    it('should show freeze button when streak >= 3 and freezes > 0', () => {
      const element = streak.render();
      const button = element.querySelector('[data-action="freeze"]');
      expect(button).toBeDefined();
    });

    it('should not show freeze button when streak < 3', () => {
      streak.streak = 2;
      const element = streak.render();
      const button = element.querySelector('[data-action="freeze"]');
      expect(button).toBeNull();
    });
  });

  describe('getFireEmoji', () => {
    it('should return snow emoji for no streak', () => {
      streak.streak = 0;
      expect(streak.getFireEmoji()).toBe('❄️');
    });

    it('should return one fire for streak >= 1', () => {
      streak.streak = 1;
      expect(streak.getFireEmoji()).toBe('🔥');
    });

    it('should return two fires for streak >= 14', () => {
      streak.streak = 14;
      expect(streak.getFireEmoji()).toBe('🔥🔥');
    });

    it('should return three fires for streak >= 30', () => {
      streak.streak = 30;
      expect(streak.getFireEmoji()).toBe('🔥🔥🔥');
    });
  });

  describe('incrementStreak', () => {
    it('should increase streak by 1', () => {
      streak.render();
      streak.incrementStreak();
      expect(streak.streak).toBe(6);
    });

    it('should update best streak if current exceeds it', () => {
      streak.streak = 10;
      streak.render();
      streak.incrementStreak();
      expect(streak.bestStreak).toBe(11);
    });

    it('should mark as studied today', () => {
      streak.render();
      streak.incrementStreak();
      expect(streak.hasStudiedToday).toBe(true);
    });
  });

  describe('resetStreak', () => {
    it('should set streak to 0', () => {
      streak.render();
      streak.resetStreak();
      expect(streak.streak).toBe(0);
    });

    it('should mark as not studied today', () => {
      streak.hasStudiedToday = true;
      streak.render();
      streak.resetStreak();
      expect(streak.hasStudiedToday).toBe(false);
    });
  });

  describe('useFreeze', () => {
    it('should decrease freezes count', () => {
      streak.render();
      streak.useFreeze();
      expect(streak.freezes).toBe(1);
    });

    it('should not go below 0 freezes', () => {
      streak.freezes = 0;
      streak.render();
      streak.useFreeze();
      expect(streak.freezes).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      const element = streak.render();
      container.appendChild(element);
      streak.destroy();
      expect(container.children.length).toBe(0);
    });
  });
});
