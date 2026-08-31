import { describe, expect, it } from 'vitest';
import { toExamPlayerQuestion, validateLocalExam } from '../services/examSchema.js';

const validExam = () => ({
  schema: 'bsestudos.exam.v1',
  id: 'enem-2026-dia-1',
  title: 'ENEM 2026 - Dia 1',
  durationMinutes: 330,
  questions: [{
    id: 'q-001',
    statement: 'Enunciado',
    options: ['A', 'B', 'C', 'D', 'E'],
    correctOption: 0,
    explanation: 'Opcional'
  }]
});

describe('local exam schema', () => {
  it('accepts an exam with five non-empty options', () => {
    expect(validateLocalExam(validExam())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['wrong schema', exam => ({ ...exam, schema: 'other' })],
    ['non-positive duration', exam => ({ ...exam, durationMinutes: 0 })],
    ['repeated question id', exam => ({ ...exam, questions: [...exam.questions, { ...exam.questions[0] }] })],
    ['out-of-range correct option', exam => ({ ...exam, questions: [{ ...exam.questions[0], correctOption: 5 }] })]
  ])('rejects %s', (_name, change) => {
    expect(validateLocalExam(change(validExam()))).toMatchObject({ valid: false });
  });

  it('adapts a question without inventing a missing explanation', () => {
    const question = validExam().questions[0];
    delete question.explanation;

    expect(toExamPlayerQuestion(question)).toEqual({
      id: 'q-001', text: 'Enunciado', answers: ['A', 'B', 'C', 'D', 'E'], correctAnswer: 0
    });
  });
});
