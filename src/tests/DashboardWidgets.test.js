import { afterEach, describe, expect, it, vi } from 'vitest';
import { HeatmapCalendar } from '../components/HeatmapCalendar.js';
import { StreakCounter } from '../components/StreakCounter.js';

describe('dashboard widget updates', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('replaces the mounted streak counter and renders its icons', () => {
    const createIcons = vi.fn();
    vi.stubGlobal('lucide', { createIcons });
    const streak = new StreakCounter({ streak: 1 });
    document.body.appendChild(streak.render());

    streak.setStreak(5, 5, 0, true);

    expect(document.body.querySelectorAll('.streak-counter')).toHaveLength(1);
    expect(document.body.querySelector('.streak-count').textContent).toBe('5');
    expect(createIcons).toHaveBeenLastCalledWith({ root: streak.element });
  });

  it('replaces the mounted heatmap with new data', () => {
    const heatmap = new HeatmapCalendar({ data: {} });
    const oldElement = heatmap.render();
    document.body.appendChild(oldElement);

    heatmap.updateData({ [new Date().toISOString().split('T')[0]]: 3 });

    expect(oldElement.isConnected).toBe(false);
    expect(heatmap.element.isConnected).toBe(true);
    expect(document.body.querySelectorAll('.heatmap-calendar')).toHaveLength(1);
  });
});
