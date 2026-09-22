import { describe, expect, it, vi } from 'vitest';
import { FlashcardsPage } from '../pages/FlashcardsPage.js';
import { FlashcardManager } from '../components/FlashcardManager.js';
import { ReviewQueue } from '../components/ReviewQueue.js';

vi.mock('../utils/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import { api } from '../utils/api.js';

describe('private beta empty states', () => {
  it('does not create sample flashcards', () => {
    expect(new FlashcardsPage({ subjects: [] }).cards).toEqual([]);
  });

  it('loads due cards and opens a review queue from the flashcards page', async () => {
    api.get.mockResolvedValueOnce({
      success: true,
      data: [{ id: 7, front: 'O que é recuperação ativa?', back: 'Tentar lembrar antes de consultar.', due_date: '2000-01-01 00:00:00', tags: [] }]
    });
    const page = new FlashcardsPage({ subjects: [] });

    const element = await page.render();

    expect(element.querySelector('[data-action="start-review"]')?.textContent).toContain('1');
    element.querySelector('[data-action="start-review"]').click();
    expect(element.querySelector('.review-queue')).not.toBeNull();
    expect(element.textContent).toContain('O que é recuperação ativa?');
  });

  it('opens a numeric-id card in the editor from the management list', () => {
    const manager = new FlashcardManager({ cards: [{ id: 7, front: 'Frente', back: 'Verso', interval: 1, easeFactor: 2.5, tags: [] }] });
    const element = manager.render();

    element.querySelector('[data-action="edit"]').click();

    expect(element.querySelector('#card-front').value).toBe('Frente');
  });

  it('keeps the current card when saving a review fails', async () => {
    const queue = new ReviewQueue({
      cards: [{ id: 7, front: 'Frente', back: 'Verso' }],
      onRating: vi.fn().mockResolvedValue(false)
    });
    queue.render();

    await queue.handleRating(3);

    expect(queue.currentIndex).toBe(0);
    expect(queue.isComplete).toBe(false);
  });
});
