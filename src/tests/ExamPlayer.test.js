import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamPlayer } from '../components/ExamPlayer.js';

function remoteQuestion(id, position, extra = {}) {
  return {
    id,
    position,
    subject: 'Matemática',
    topic: null,
    statement: `Enunciado ${id}`,
    options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
    images: [],
    ...extra,
  };
}

function remoteSession(overrides = {}) {
  return {
    id: 'session-1',
    kind: 'practice',
    status: 'active',
    subject: 'Matemática',
    topic: null,
    question_limit: 3,
    time_limit_seconds: 1500,
    current_position: 0,
    elapsed_seconds: 0,
    questions: [remoteQuestion(5, 0), remoteQuestion(7, 1), remoteQuestion(9, 2)],
    answers: [],
    result: null,
    ...overrides,
  };
}

function completedSession() {
  return remoteSession({
    status: 'completed',
    questions: [
      remoteQuestion(5, 0, { correct_option: 'A' }),
      remoteQuestion(7, 1, { correct_option: 'D' }),
      remoteQuestion(9, 2, { correct_option: 'B' }),
    ],
    answers: [
      { question_id: 5, selected_option: 'A', flagged: false, is_correct: true },
      { question_id: 7, selected_option: 'C', flagged: true, is_correct: false },
    ],
    result: { correct: 1, incorrect: 1, unanswered: 1, score: 33.33 },
  });
}

function mount(player) {
  const element = player.render();
  document.body.appendChild(element);
  return element;
}

describe('ExamPlayer with a remote session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('restores a remote draft and saves after 500ms', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({
      session: remoteSession({ current_position: 1, answers: [{ question_id: 7, selected_option: 'C', flagged: true }] }),
      onProgressSaved: saved,
    });
    const element = mount(player);
    player.start();

    expect(element.querySelector('.question-text').textContent).toBe('Enunciado 7');
    expect(element.querySelector('.question-answer.selected .question-answer-letter').textContent).toBe('C');
    expect(element.querySelector('.question-flag-btn').classList.contains('flagged')).toBe(true);

    player.handleAnswer(7, 1);
    await vi.advanceTimersByTimeAsync(499);
    expect(saved).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ position: 1 }));
    const payload = saved.mock.calls[0][0];
    expect(payload.answers).toContainEqual({ question_id: 7, selected_option: 'B', flagged: true });
    expect(payload.answers).toContainEqual({ question_id: 5, selected_option: null, flagged: false });
    player.destroy();
  });

  it('debounces rapid changes into one save', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved });
    mount(player);
    player.start();

    player.handleAnswer(5, 0);
    await vi.advanceTimersByTimeAsync(200);
    player.handleFlag(5, true);
    await vi.advanceTimersByTimeAsync(200);
    player.nextQuestion();
    await vi.advanceTimersByTimeAsync(500);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][0]).toMatchObject({ position: 1 });
    expect(saved.mock.calls[0][0].answers).toContainEqual({ question_id: 5, selected_option: 'A', flagged: true });
    player.destroy();
  });

  it('computes elapsed time from the persisted baseline plus time in this tab', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({ session: remoteSession({ elapsed_seconds: 120 }), onProgressSaved: saved });
    const element = mount(player);
    player.start();

    expect(element.querySelector('.exam-time').textContent).toBe('23:00');
    await vi.advanceTimersByTimeAsync(10_000);
    player.handleAnswer(5, 2);
    await vi.advanceTimersByTimeAsync(500);

    expect(saved.mock.calls[0][0].elapsed_seconds).toBe(130);
    player.destroy();
  });

  it('selects options with keys A–E and toggles the flag with F', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved });
    const element = mount(player);
    player.start();

    const card = element.querySelector('.question-card');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', bubbles: true }));
    await vi.advanceTimersByTimeAsync(500);

    expect(saved.mock.calls[0][0].answers).toContainEqual({ question_id: 5, selected_option: 'E', flagged: true });
    player.destroy();
  });

  it('navigates when a question dot is clicked', () => {
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: vi.fn().mockResolvedValue(undefined) });
    const element = mount(player);
    player.start();

    element.querySelector('.exam-dot[data-index="2"]').click();

    expect(element.querySelector('.question-text').textContent).toBe('Enunciado 9');
    player.destroy();
  });

  it('keeps answers and offers a retry when saving fails', async () => {
    const saved = vi.fn()
      .mockRejectedValueOnce(new Error('Sem conexão.'))
      .mockResolvedValueOnce(undefined);
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved });
    const element = mount(player);
    player.start();

    element.querySelector('.question-answer[data-answer="3"]').click();
    await vi.advanceTimersByTimeAsync(500);

    const alert = element.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('Sem conexão.');
    expect(element.querySelector('.question-answer.selected .question-answer-letter').textContent).toBe('D');

    element.querySelector('[data-action="retry-save"]').click();
    await vi.advanceTimersByTimeAsync(0);

    expect(saved).toHaveBeenCalledTimes(2);
    expect(saved.mock.calls[1][0].answers).toContainEqual({ question_id: 5, selected_option: 'D', flagged: false });
    expect(element.querySelector('[role="alert"]')).toBeNull();
    player.destroy();
  });

  it('flushes the pending draft before completing', async () => {
    const calls = [];
    const saved = vi.fn(async () => { calls.push('save'); });
    const complete = vi.fn(async () => { calls.push('complete'); });
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved, onComplete: complete });
    mount(player);
    player.start();

    player.handleAnswer(5, 1);
    await player.finish();

    expect(calls).toEqual(['save', 'complete']);
    expect(saved.mock.calls[0][0].answers).toContainEqual({ question_id: 5, selected_option: 'B', flagged: false });
    player.destroy();
  });

  it('does not complete when the final save fails', async () => {
    const saved = vi.fn().mockRejectedValue(new Error('Falha ao salvar.'));
    const complete = vi.fn();
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved, onComplete: complete });
    const element = mount(player);
    player.start();

    await player.finish();

    expect(complete).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]').textContent).toContain('Falha ao salvar.');
    player.destroy();
  });

  it('offers to retry completion after a failed complete request', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const complete = vi.fn()
      .mockRejectedValueOnce(new Error('Servidor indisponível.'))
      .mockResolvedValueOnce(undefined);
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved, onComplete: complete });
    const element = mount(player);
    player.start();

    await player.finish();
    expect(element.querySelector('[role="alert"]').textContent).toContain('Servidor indisponível.');

    element.querySelector('[role="alert"] [data-action="finish"]').click();
    await vi.advanceTimersByTimeAsync(0);

    expect(complete).toHaveBeenCalledTimes(2);
    player.destroy();
  });

  it('completes automatically when the time limit expires', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const complete = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({
      session: remoteSession({ time_limit_seconds: 60, elapsed_seconds: 58 }),
      onProgressSaved: saved,
      onComplete: complete,
    });
    mount(player);
    player.start();

    await vi.advanceTimersByTimeAsync(2000);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls.at(-1)[0].elapsed_seconds).toBe(60);
    player.destroy();
  });

  it('stops its timers on destroy and flushes the pending draft once', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved });
    mount(player);
    player.start();

    player.handleAnswer(5, 0);
    player.destroy();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('saves elapsed time with keepalive when the page is hidden or unloaded', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const player = new ExamPlayer({ session: remoteSession({ elapsed_seconds: 40 }), onProgressSaved: saved });
    mount(player);
    player.start();

    await vi.advanceTimersByTimeAsync(7000);
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);

    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ elapsed_seconds: 47 }), { keepalive: true });
    player.destroy();
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('saves progress and leaves through the exit action', async () => {
    const saved = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const player = new ExamPlayer({ session: remoteSession(), onProgressSaved: saved, onExit: exit });
    const element = mount(player);
    player.start();

    element.querySelector('[data-action="exit"]').click();
    await vi.advanceTimersByTimeAsync(0);

    expect(saved).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    player.destroy();
  });

  it('reviews a completed session read-only, with correctness and no saves', async () => {
    const saved = vi.fn();
    const exit = vi.fn();
    const player = new ExamPlayer({ session: completedSession(), onProgressSaved: saved, onExit: exit });
    const element = mount(player);
    player.start();

    element.querySelector('.exam-dot[data-index="1"]').click();
    const answers = [...element.querySelectorAll('.question-answer')];
    expect(answers.every((button) => button.disabled)).toBe(true);
    expect(answers[3].classList.contains('correct')).toBe(true);
    expect(answers[2].classList.contains('wrong')).toBe(true);
    expect(element.querySelector('.question-flag-btn').disabled).toBe(true);
    expect(element.querySelector('[data-action="finish"]')).toBeNull();

    element.querySelector('.question-card').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(saved).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    element.querySelector('[data-action="exit"]').click();
    expect(exit).toHaveBeenCalledTimes(1);
    player.destroy();
  });

  it('does not expose correctness while the session is active', () => {
    const player = new ExamPlayer({ session: remoteSession({ answers: [{ question_id: 5, selected_option: 'A', flagged: false }] }) });
    const element = mount(player);
    player.start();

    expect(element.querySelector('.question-answer.correct, .question-answer.wrong')).toBeNull();
    player.destroy();
  });
});
