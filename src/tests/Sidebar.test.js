import { describe, expect, it } from 'vitest';
import { Sidebar } from '../components/Sidebar.js';

describe('Sidebar', () => {
  it('uses an icon provided by the Lucide CDN for Flashcards', () => {
    const element = new Sidebar({ user: { id: 1, name: 'Teste', xp: 0, xpMax: 100, level: 1, streak: 0 } }).render();

    expect(element.querySelector('[data-route="flashcards"] i')?.getAttribute('data-lucide')).toBe('layers');
  });
});
