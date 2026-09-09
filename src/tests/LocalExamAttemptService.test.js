import { describe, expect, it } from 'vitest';
import { LocalExamAttemptService } from '../services/LocalExamAttemptService.js';

function memoryStore() {
  const values = new Map();
  return { async get(key) { return values.get(key); }, async set(key, value) { values.set(key, structuredClone(value)); } };
}

describe('LocalExamAttemptService', () => {
  it('persists only incorrect local-exam answers inside the user and library scope', async () => {
    const service = new LocalExamAttemptService({ idb: memoryStore(), userId: 'user-1', libraryId: 'library-a', now: () => '2026-09-08T12:00:00.000Z' });
    await service.record({
      exam: { id: 'anatomia-01', title: 'Anatomia' },
      questionResults: [
        { questionId: 'q1', questionText: 'Qual osso?', selectedAnswer: 0, correctAnswer: 1, isCorrect: false },
        { questionId: 'q2', questionText: 'Qual músculo?', selectedAnswer: 2, correctAnswer: 2, isCorrect: true }
      ]
    });

    await expect(service.listErrors()).resolves.toEqual([expect.objectContaining({
      examId: 'anatomia-01', questionId: 'q1', questionText: 'Qual osso?', selectedAnswer: 0, correctAnswer: 1
    })]);
  });
});
