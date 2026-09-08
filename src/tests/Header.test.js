import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../components/Header.js';

describe('Header Pomodoro', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops its timer when the application header is destroyed', () => {
    vi.useFakeTimers();
    const header = new Header({ user: { id: 1, name: 'Bruno' } });
    header.render();
    header.startPomodoro();
    header.destroy();

    vi.advanceTimersByTime(1000);

    expect(header.pomodoroTime).toBe(25 * 60);
    expect(header.pomodoroActive).toBe(false);
  });

  it('offers a long break after four completed focus cycles', () => {
    const header = new Header({ user: { id: 1, name: 'Bruno' } });
    header.render();

    for (let cycle = 0; cycle < 4; cycle += 1) {
      header.pomodoroMode = 'focus';
      header.completePomodoroCycle();
    }

    expect(header.pomodoroMode).toBe('break');
    expect(header.pomodoroTime).toBe(15 * 60);
  });
});
