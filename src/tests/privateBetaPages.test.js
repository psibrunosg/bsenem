import { describe, expect, it } from 'vitest';
import { FlashcardsPage } from '../pages/FlashcardsPage.js';
import { ExamsPage } from '../pages/ExamsPage.js';

describe('private beta empty states', () => {
  it('does not create sample flashcards', () => {
    expect(new FlashcardsPage({ subjects: [] }).cards).toEqual([]);
  });

  it('does not list an exam without a real collection', () => {
    expect(new ExamsPage({ subjects: [] }).exams).toEqual([]);
  });
});
