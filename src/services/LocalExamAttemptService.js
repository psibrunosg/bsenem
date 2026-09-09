import { idb as browserIdb } from '@utils/idb.js';

export class LocalExamAttemptService {
  constructor({ idb = browserIdb, userId, libraryId, now = () => new Date().toISOString() } = {}) {
    if (!userId || !libraryId) throw new Error('userId and libraryId are required');
    this.idb = idb;
    this.userId = String(userId);
    this.libraryId = String(libraryId);
    this.now = now;
  }

  async record(results) {
    const previous = await this.listErrors();
    const errors = (results?.questionResults ?? [])
      .filter((result) => result.isCorrect === false)
      .map((result) => ({
        examId: results.exam?.id,
        examTitle: results.exam?.title ?? 'Simulado',
        questionId: result.questionId,
        questionText: result.questionText ?? '',
        selectedAnswer: result.selectedAnswer,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation ?? '',
        completedAt: this.now()
      }));
    await this.idb.set(this.key(), [...errors, ...previous]);
    return errors;
  }

  async listErrors() {
    const entries = await this.idb.get(this.key());
    return Array.isArray(entries) ? entries : [];
  }

  key() { return `local-exam-errors:${this.userId}:${this.libraryId}`; }
}
