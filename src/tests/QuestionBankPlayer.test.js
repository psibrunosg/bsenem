import { describe, expect, it, vi } from 'vitest';
import { ExamPlayer } from '../components/ExamPlayer.js';
import { QuestionCard } from '../components/QuestionCard.js';

describe('question bank session player', () => {
  it('submits selected options for server-side correction without a client answer key', async () => {
    const remoteSubmit = vi.fn().mockResolvedValue({ score: 100, correct: 1, incorrect: 0, unanswered: 0, questionResults: [] });
    const onComplete = vi.fn();
    const player = new ExamPlayer({
      exam: { id: 'session-1', title: 'ENEM', subject: 'Matemática' },
      questions: [{ id: 'enem:1', text: 'Pergunta', answers: ['A', 'B', 'C', 'D', 'E'] }],
      remoteSubmit,
      onComplete
    });
    player.render();
    player.start();
    player.handleAnswer('enem:1', 2);

    player.finish();

    await vi.waitFor(() => expect(remoteSubmit).toHaveBeenCalledWith({ answers: [{ questionId: 'enem:1', selectedOption: 2, flagged: false }] }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ score: 100 }));
  });
});

describe('official ENEM figures', () => {
  it('renders every image from a corrected bank question in source order', () => {
    const element = new QuestionCard({
      question: { id: 'enem:1', text: 'Questão ilustrada', answers: ['A', 'B', 'C', 'D', 'E'], images: ['/question-assets/enem/assets/a.png', '/question-assets/enem/assets/b.png'] }
    }).render();

    expect([...element.querySelectorAll('.question-image img')].map((image) => image.getAttribute('src')))
      .toEqual(['/question-assets/enem/assets/a.png', '/question-assets/enem/assets/b.png']);
  });
});
