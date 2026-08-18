// src/tests/XPBar.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { XPBar } from '../components/XPBar.js';

describe('XPBar', () => {
  let container;
  let xpBar;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    xpBar = new XPBar({
      currentXP: 500,
      maxXP: 1000,
      level: 1
    });
  });

  describe('render', () => {
    it('should render the XP bar element', () => {
      const element = xpBar.render();
      expect(element).toBeDefined();
      expect(element.classList.contains('xp-bar')).toBe(true);
    });

    it('should display current level', () => {
      const element = xpBar.render();
      const levelBadge = element.querySelector('.xp-level-badge');
      expect(levelBadge.textContent).toContain('1');
    });

    it('should display correct XP percentage', () => {
      const element = xpBar.render();
      const percent = element.querySelector('.xp-bar-percent');
      expect(percent.textContent).toBe('50%');
    });

    it('should display current level XP (modulo)', () => {
      const element = xpBar.render();
      const current = element.querySelector('.xp-current');
      expect(current.textContent).toBe('500');
    });

    it('should render progress bar with correct width', () => {
      const element = xpBar.render();
      const fill = element.querySelector('.xp-bar-fill');
      expect(fill.style.width).toBe('50%');
    });
  });

  describe('setXP', () => {
    it('should update XP value', () => {
      xpBar.render();
      xpBar.setXP(750);
      expect(xpBar.currentXP).toBe(750);
    });

    it('should update level when XP exceeds max', () => {
      xpBar.render();
      xpBar.setXP(1100);
      expect(xpBar.level).toBe(2);
    });

    it('should call onLevelUp when level increases', () => {
      let calledLevel = null;
      xpBar.onLevelUp = (level) => { calledLevel = level; };
      xpBar.render();
      xpBar.setXP(1000);
      expect(calledLevel).toBe(2);
    });

    it('should not call onLevelUp when level stays same', () => {
      let called = false;
      xpBar.onLevelUp = () => { called = true; };
      xpBar.render();
      xpBar.setXP(700);
      expect(called).toBe(false);
    });
  });

  describe('addXP', () => {
    it('should add XP to current value', () => {
      xpBar.render();
      xpBar.addXP(250);
      expect(xpBar.currentXP).toBe(750);
    });
  });

  describe('updateUI', () => {
    it('should update displayed fill width', () => {
      xpBar.render();
      xpBar.currentXP = 800;
      xpBar.updateUI();
      
      const fill = xpBar.element.querySelector('.xp-bar-fill');
      expect(fill.style.width).toBe('80%');
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      const element = xpBar.render();
      container.appendChild(element);
      xpBar.destroy();
      expect(container.children.length).toBe(0);
    });
  });
});
