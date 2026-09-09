import { describe, expect, it, vi } from 'vitest';
import { FlashcardsPage } from '../pages/FlashcardsPage.js';
import { ExamsPage } from '../pages/ExamsPage.js';
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

  it('does not list an exam without a real collection', () => {
    expect(new ExamsPage({ subjects: [] }).exams).toEqual([]);
  });

  it('lists and starts a validated local exam from the learner library', () => {
    const exam = {
      id: 'anatomia-01', title: 'Anatomia', durationMinutes: 30,
      questions: [{ id: 'q1', statement: 'Qual é o osso?', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 1 }]
    };
    const library = {
      items: [{ id: 'local-exam', resourceType: 'exam', title: 'Anatomia', collection: 'Saúde' }],
      getExam: vi.fn(() => exam)
    };
    const page = new ExamsPage({ library });
    const element = page.render();

    expect(element.textContent).toContain('Anatomia');
    element.querySelector('[data-action="start-exam"]').click();

    expect(library.getExam).toHaveBeenCalledWith('local-exam');
    expect(element.querySelector('.exam-player')).not.toBeNull();
  });

  it('shows the persisted local error notebook without example entries', () => {
    const page = new ExamsPage();
    const element = page.render();
    page.errors = [{ examTitle: 'Anatomia', questionText: 'Qual osso?' }];

    page.showErrors();

    expect(element.querySelector('.exams-error-notebook').textContent).toContain('Qual osso?');
    expect(element.textContent).not.toContain('Matemática');
  });

  it('records errors when a local exam is completed', async () => {
    const attemptService = { listErrors: vi.fn().mockResolvedValue([]), record: vi.fn().mockResolvedValue([{ questionId: 'q1' }]) };
    const page = new ExamsPage({ attemptService });
    page.render();

    page.showResults({ exam: { id: 'anatomia', title: 'Anatomia' }, score: 0, totalQuestions: 1, correct: 0, incorrect: 1, unanswered: 0, totalTime: 0, questionResults: [{ questionId: 'q1', isCorrect: false }] });
    await vi.waitFor(() => expect(attemptService.record).toHaveBeenCalled());

    expect(page.errors).toEqual([{ questionId: 'q1' }]);
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
