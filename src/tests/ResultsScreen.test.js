import { describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../utils/api.js', () => ({ api }));

const { ResultsScreen } = await import('../components/ResultsScreen.js');

const completedSession = {
  id: 'session-1',
  kind: 'practice',
  status: 'completed',
  subject: 'Matemática',
  topic: null,
  question_limit: 3,
  time_limit_seconds: 1500,
  elapsed_seconds: 754,
  questions: [
    { id: 5, position: 0, correct_option: 'A' },
    { id: 7, position: 1, correct_option: 'D' },
    { id: 9, position: 2, correct_option: 'B' },
  ],
  answers: [
    { question_id: 5, selected_option: 'A', flagged: false, is_correct: true },
    { question_id: 7, selected_option: 'C', flagged: true, is_correct: false },
  ],
};
const completedResult = { correct: 1, incorrect: 1, unanswered: 1, score: 33.33 };

describe('ResultsScreen', () => {
  it('does not post a legacy attempt from results', () => {
    new ResultsScreen({ result: completedResult, session: completedSession }).render();

    expect(api.post).not.toHaveBeenCalledWith('/exams/attempt', expect.anything());
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the totals confirmed by the server', () => {
    const element = new ResultsScreen({ result: completedResult, session: completedSession }).render();
    const text = element.textContent;

    expect(text).toContain('Matemática');
    expect(text).toContain('1 de 3');
    expect(text).toContain('33%');
    expect(element.querySelector('[data-stat="correct"]').textContent).toContain('1');
    expect(element.querySelector('[data-stat="incorrect"]').textContent).toContain('1');
    expect(element.querySelector('[data-stat="unanswered"]').textContent).toContain('1');
    expect(element.querySelector('[data-stat="time"]').textContent).toContain('12:34');
  });

  it('lists each question with a textual status, not only color', () => {
    const element = new ResultsScreen({ result: completedResult, session: completedSession }).render();
    const items = [...element.querySelectorAll('.results-question-item')];

    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Correta');
    expect(items[1].textContent).toContain('Errada');
    expect(items[1].textContent).toContain('Marcada');
    expect(items[2].textContent).toContain('Sem resposta');
  });

  it('has no emoji and no inline styles', () => {
    const element = new ResultsScreen({ result: completedResult, session: completedSession }).render();

    expect(element.querySelector('[style]')).toBeNull();
    expect(element.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('routes review, retry and back actions to callbacks', () => {
    const onReview = vi.fn();
    const onRetry = vi.fn();
    const onBack = vi.fn();
    const element = new ResultsScreen({ result: completedResult, session: completedSession, onReview, onRetry, onBack }).render();

    element.querySelector('[data-action="review"]').click();
    element.querySelector('[data-action="retry"]').click();
    element.querySelector('[data-action="back"]').click();

    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
