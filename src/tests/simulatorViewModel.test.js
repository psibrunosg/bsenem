import { describe, expect, it } from 'vitest';
import { overviewViewModel } from '../services/simulatorViewModel.js';

describe('overviewViewModel', () => {
  it('returns a disabled content-unavailable hero when no subjects are published', () => {
    const view = overviewViewModel({ subjects: [], recommendation: null, mastery: [], active_sessions: [] });

    expect(view.hero.kind).toBe('unavailable');
    expect(view.hero.ctaDisabled).toBe(true);
    expect(view.mastery).toEqual([]);
  });

  it('returns a subject-chooser hero with no fabricated percentage when history is empty', () => {
    const view = overviewViewModel({
      subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }],
      recommendation: null,
      mastery: [],
      active_sessions: [],
    });

    expect(view.hero.kind).toBe('choose-subject');
    expect(view.hero.description).not.toContain('0%');
    expect(view.hero.subjects).toEqual([{ key: 'Matemática', label: 'Matemática', available: 10 }]);
  });

  it('returns a subject-chooser hero with no fabricated percentage when history is insufficient', () => {
    const view = overviewViewModel({
      subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }],
      recommendation: null,
      mastery: [{ subject: 'Matemática', answered_count: 3, accuracy: null, status: 'insufficient', action: 'choose_subject' }],
      active_sessions: [],
    });

    expect(view.hero.kind).toBe('choose-subject');
    expect(view.mastery[0].accuracyLabel).toBe('Dados insuficientes');
    expect(view.mastery[0].accuracyLabel).not.toContain('0%');
  });

  it('returns a recommended-practice hero with subject, sample size and accuracy when history is sufficient', () => {
    const view = overviewViewModel({
      subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }],
      recommendation: { subject: 'Matemática', topic: null, answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' },
      mastery: [{ subject: 'Matemática', answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' }],
      active_sessions: [],
    });

    expect(view.hero.kind).toBe('recommended');
    expect(view.hero.subject).toBe('Matemática');
    expect(view.hero.description).toContain('Matemática');
    expect(view.hero.description).toContain('8');
    expect(view.hero.description).toContain('42.5%');
    expect(view.mastery[0].statusLabel).toBe('Ponto de atenção');
  });

  it('includes the topic in the recommendation description when present', () => {
    const view = overviewViewModel({
      subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }],
      recommendation: { subject: 'Matemática', topic: 'Funções', answered_count: 6, accuracy: 66.67, status: 'evolving', action: 'practice' },
      mastery: [],
      active_sessions: [],
    });

    expect(view.hero.topic).toBe('Funções');
    expect(view.hero.description).toContain('Funções');
  });

  it('surfaces the most recently updated active session as resume', () => {
    const view = overviewViewModel({
      subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }],
      recommendation: null,
      mastery: [],
      active_sessions: [
        { id: 'newest', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 300, answered_count: 4, updated_at: '2026-09-22 10:00:00' },
        { id: 'older', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 100, answered_count: 1, updated_at: '2026-09-21 10:00:00' },
      ],
    });

    expect(view.resume.id).toBe('newest');
    expect(view.resume.remainingSeconds).toBe(1200);
    expect(view.otherActiveCount).toBe(1);
  });

  it('has no resume when there are no active sessions', () => {
    const view = overviewViewModel({ subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }], recommendation: null, mastery: [], active_sessions: [] });

    expect(view.resume).toBeNull();
    expect(view.otherActiveCount).toBe(0);
  });
});
