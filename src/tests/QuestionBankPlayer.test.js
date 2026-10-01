import { describe, expect, it, vi } from 'vitest';
import { ExamsPage } from '../pages/ExamsPage.js';
import { QuestionCard } from '../components/QuestionCard.js';

const ok = (data) => ({ success: true, data });

function questionBankApi() {
  const get = vi.fn((url) => {
    if (url === '/simulators/catalog') return Promise.resolve(ok({ subjects: [], catalogs: [] }));
    if (url === '/simulators/overview') return Promise.resolve(ok({ recommendation: null, mastery: [], active_sessions: [] }));
    if (url === '/question-bank/facets') return Promise.resolve(ok({
      tracks: [{ slug: 'enem', label: 'ENEM', count: 10 }],
      subjects: [], specialties: [], topics: []
    }));
    if (url.startsWith('/question-bank/facets?track=enem')) return Promise.resolve(ok({
      tracks: [{ slug: 'enem', label: 'ENEM', count: 10 }],
      subjects: [{ slug: 'matematica', label: 'Matemática e suas Tecnologias', count: 10 }],
      specialties: [], topics: []
    }));
    return Promise.resolve({ success: false, message: `unexpected GET ${url}` });
  });

  const post = vi.fn((url) => {
    if (url === '/question-bank/sessions') return Promise.resolve(ok({
      sessionId: 'qb-1',
      title: 'ENEM · Matemática e suas Tecnologias',
      filters: { track: 'enem', subject: 'matematica' },
      questions: [{
        id: 'enem:1',
        text: 'Pergunta',
        answers: ['A', 'B', 'C', 'D', 'E'],
        images: ['/api/simulators/questions/inep%3A1/images/0'],
        source: 'ENEM 2025'
      }]
    }));
    if (url === '/question-bank/sessions/qb-1/submit') return Promise.resolve(ok({
      totalQuestions: 1, correct: 1, incorrect: 0, unanswered: 0, score: 100, totalTime: 12,
      questionResults: [{
        questionId: 'enem:1', selectedAnswer: 2, correctAnswer: 2, isCorrect: true, flagged: false,
        question: { id: 'enem:1', text: 'Pergunta', answers: ['A', 'B', 'C', 'D', 'E'], images: ['/api/simulators/questions/inep%3A1/images/0'], correctAnswer: 2 }
      }]
    }));
    return Promise.resolve({ success: false, message: `unexpected POST ${url}` });
  });

  return { get, post, patch: vi.fn() };
}

describe('question bank session player', () => {
  it('submits selected options for server-side correction through the current ExamPlayer contract', async () => {
    const api = questionBankApi();
    const page = new ExamsPage({ user: { id: 7 }, apiClient: api });
    const element = await page.render();

    await vi.waitFor(() => expect(element.querySelector('[data-question-bank-track]')).not.toBeNull());
    const track = element.querySelector('[data-question-bank-track]');
    track.value = 'enem';
    track.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(element.querySelector('[data-question-bank-subject] option[value="matematica"]')).not.toBeNull());
    const subject = element.querySelector('[data-question-bank-subject]');
    subject.value = 'matematica';
    subject.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(element.querySelector('[data-action="start-question-bank"]').disabled).toBe(false));
    element.querySelector('[data-action="start-question-bank"]').click();

    await vi.waitFor(() => expect(element.querySelector('.exam-player')).not.toBeNull());
    element.querySelector('.question-answer[data-answer="2"]').click();
    element.querySelector('[data-action="finish"]').click();

    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/question-bank/sessions/qb-1/submit', {
      answers: [{ questionId: 'enem:1', selectedOption: 2, flagged: false }]
    }));
    await vi.waitFor(() => expect(element.querySelector('.results-screen')).not.toBeNull());
    expect(element.querySelector('.results-score-value').textContent).toBe('100%');
    page.destroy();
  });
});

describe('official ENEM figures', () => {
  it('renders every authenticated image URL from a corrected bank question in source order', () => {
    const element = new QuestionCard({
      question: {
        id: 'enem:1',
        text: 'Questão ilustrada',
        answers: ['A', 'B', 'C', 'D', 'E'],
        images: ['/api/simulators/questions/inep%3A1/images/0', '/api/simulators/questions/inep%3A1/images/1']
      }
    }).render();

    expect([...element.querySelectorAll('.question-image img')].map((image) => image.getAttribute('src')))
      .toEqual(['/api/simulators/questions/inep%3A1/images/0', '/api/simulators/questions/inep%3A1/images/1']);
  });
});
