// src/tests/HeatmapCalendar.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { HeatmapCalendar } from '../components/HeatmapCalendar.js';

describe('HeatmapCalendar', () => {
  let container;
  let heatmap;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    heatmap = new HeatmapCalendar({
      data: {
        '2024-01-01': 5,
        '2024-01-02': 10,
        '2024-01-03': 0
      },
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-07')
    });
  });

  describe('render', () => {
    it('should render the heatmap element', () => {
      const element = heatmap.render();
      expect(element).toBeDefined();
      expect(element.classList.contains('heatmap-calendar')).toBe(true);
    });

    it('should contain month labels', () => {
      const element = heatmap.render();
      const months = element.querySelectorAll('.heatmap-month');
      expect(months.length).toBeGreaterThan(0);
    });

    it('should contain day labels', () => {
      const element = heatmap.render();
      const dayLabels = element.querySelectorAll('.heatmap-day-label');
      expect(dayLabels.length).toBe(7);
    });

    it('should contain cells for each day', () => {
      const element = heatmap.render();
      const cells = element.querySelectorAll('.heatmap-cell:not(.empty)');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('should display stats', () => {
      const element = heatmap.render();
      const stats = element.querySelector('.heatmap-stats');
      expect(stats.textContent).toContain('dias');
    });

    it('should display legend', () => {
      const element = heatmap.render();
      const legend = element.querySelector('.heatmap-legend');
      expect(legend).toBeDefined();
    });
  });

  describe('getLevel', () => {
    it('should return 0 for no activity', () => {
      expect(heatmap.getLevel(0)).toBe(0);
    });

    it('should return 1 for low activity (1-2)', () => {
      expect(heatmap.getLevel(1)).toBe(1);
      expect(heatmap.getLevel(2)).toBe(1);
    });

    it('should return 2 for medium activity (3-5)', () => {
      expect(heatmap.getLevel(3)).toBe(2);
      expect(heatmap.getLevel(5)).toBe(2);
    });

    it('should return 3 for high activity (6-10)', () => {
      expect(heatmap.getLevel(6)).toBe(3);
      expect(heatmap.getLevel(10)).toBe(3);
    });

    it('should return 4 for very high activity (>10)', () => {
      expect(heatmap.getLevel(11)).toBe(4);
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-03-15T12:00:00');
      expect(heatmap.formatDate(date)).toBe('2024-03-15');
    });
  });

  describe('updateData', () => {
    it('should update data and re-render', () => {
      heatmap.render();
      heatmap.updateData({ '2024-06-01': 8 });
      expect(heatmap.data['2024-06-01']).toBe(8);
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      const element = heatmap.render();
      container.appendChild(element);
      heatmap.destroy();
      expect(container.children.length).toBe(0);
    });
  });
});
