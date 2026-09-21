import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashcardsPage } from '../pages/FlashcardsPage.js';
import { ExamsPage } from '../pages/ExamsPage.js';
import { FlashcardManager } from '../components/FlashcardManager.js';
import { ReviewQueue } from '../components/ReviewQueue.js';

vi.mock('../utils/api.js', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import { api } from '../utils/api.js';

describe('private beta empty states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not create sample flashcards', () => {
    expect(new FlashcardsPage({ subjects: [] }).cards).toEqual([]);
  });

  it('does not invent simulados when the permanent catalog is empty', async () => {
    api.get.mockResolvedValueOnce({ success: true, data: { catalogs: [], subjects: [] } });
    const element = await new ExamsPage().render();
    expect(element.textContent).toContain('Ainda não há simulados publicados.');
  });

  it('lists and starts a published simulado from the server catalog', async () => {
    const catalog = { id: 'enem:dia-1', title: 'ENEM dia 1', category: 'enem', subject: 'Linguagens', question_count: 45 };
    const exam = { id: catalog.id, title: catalog.title, subject: catalog.subject, questions: [{ id: 'q1', statement: 'Questão?', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 1 }] };
    api.get.mockResolvedValueOnce({ success: true, data: { catalogs: [catalog], subjects: [] } });
    api.get.mockResolvedValueOnce({ success: true, data: { exam } });
    const page = new ExamsPage();
    const element = await page.render();
    element.querySelector('[data-action="start-catalog-exam"]').click();
    await vi.waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/simulators/catalog/enem%3Adia-1'));
    expect(element.querySelector('.exam-player')).not.toBeNull();
  });

  it('sends a permanent catalog attempt to the server', async () => {
    api.get.mockResolvedValueOnce({ success: true, data: { catalogs: [], subjects: [] } });
    api.post.mockResolvedValueOnce({ success: true });
    const page = new ExamsPage();
    await page.render();
    page.activeExam = { id: 'enem:dia-1', title: 'ENEM dia 1', subject: 'Linguagens', questions: [] };
    page.activeKind = 'catalog';
    await page.recordAttempt({ score: 80, totalQuestions: 5, totalTime: 10, questionResults: [] });
    expect(api.post).toHaveBeenCalledWith('/simulators/catalog/enem%3Adia-1/attempt', expect.objectContaining({ score: 80 }));
  });

  it('loads due cards and opens a review queue from the flashcards page', async () => {
    api.get.mockResolvedValueOnce({ success: true, data: [{ id: 7, front: 'O que é recuperação ativa?', back: 'Tentar lembrar antes de consultar.', due_date: '2000-01-01 00:00:00', tags: [] }] });
    const page = new FlashcardsPage({ subjects: [] });
    const element = await page.render();
    expect(element.querySelector('[data-action="start-review"]')?.textContent).toContain('1');
    element.querySelector('[data-action="start-review"]').click();
    expect(element.querySelector('.review-queue')).not.toBeNull();
  });

  it('opens a numeric-id card in the editor from the management list', () => {
    const manager = new FlashcardManager({ cards: [{ id: 7, front: 'Frente', back: 'Verso', interval: 1, easeFactor: 2.5, tags: [] }] });
    const element = manager.render();
    element.querySelector('[data-action="edit"]').click();
    expect(element.querySelector('#card-front').value).toBe('Frente');
  });

  it('keeps the current card when saving a review fails', async () => {
    const queue = new ReviewQueue({ cards: [{ id: 7, front: 'Frente', back: 'Verso' }], onRating: vi.fn().mockResolvedValue(false) });
    queue.render();
    await queue.handleRating(3);
    expect(queue.currentIndex).toBe(0);
    expect(queue.isComplete).toBe(false);
  });
});
