import { describe, expect, it, vi } from 'vitest';
import { FlashcardsPage } from '../pages/FlashcardsPage.js';
import { ExamsPage } from '../pages/ExamsPage.js';

vi.mock('../utils/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import { api } from '../utils/api.js';

describe('private beta empty states', () => {
  it('does not create sample flashcards', () => {
    expect(new FlashcardsPage({ subjects: [] }).cards).toEqual([]);
  });

  it('does not list an exam without a real collection', () => {
    expect(new ExamsPage({ subjects: [] }).exams).toEqual([]);
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
});
