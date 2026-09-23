import { describe, expect, it, vi } from 'vitest';
import { ExamsPage } from '../pages/ExamsPage.js';

function ok(data) {
  return { success: true, data };
}

function fail(message) {
  return { success: false, message };
}

function mockApi({ catalog, overview, onCreateSession } = {}) {
  const get = vi.fn((url) => {
    if (url === '/simulators/catalog') return Promise.resolve(ok(catalog));
    if (url === '/simulators/overview') return Promise.resolve(ok(overview));
    return Promise.resolve(fail(`unexpected GET ${url}`));
  });
  const post = vi.fn((url, body) => {
    if (url === '/simulators/sessions') {
      const session = onCreateSession ? onCreateSession(body) : { id: 'new-session', kind: body.kind };
      return Promise.resolve(ok({ session }));
    }
    return Promise.resolve(fail(`unexpected POST ${url}`));
  });
  return { get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() };
}

const emptyCatalog = { subjects: [] };
const oneSubjectCatalog = { subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }], catalogs: [] };
const fullCatalog = {
  subjects: [
    { key: 'Matemática', label: 'Matemática', available: 10 },
    { key: 'Psicologia', label: 'Psicologia', available: 40 },
  ],
  catalogs: [
    { id: 'enem:mat', title: 'Simulado — Matemática (45 Questões)', category: 'enem', subject: 'Matemática', question_count: 45, duration_minutes: 135 },
    { id: 'concursos:psicologia', title: 'Concursos — Psicologia', category: 'concursos', subject: 'Psicologia', question_count: 40, duration_minutes: null },
  ],
};
const emptyOverview = { recommendation: null, mastery: [], active_sessions: [] };

describe('ExamsPage', () => {
  it('shows a loading state before the first load resolves', async () => {
    let resolveOverview;
    const overviewPromise = new Promise((resolve) => { resolveOverview = resolve; });
    const api = {
      get: vi.fn((url) => {
        if (url === '/simulators/catalog') return Promise.resolve(ok(oneSubjectCatalog));
        if (url === '/simulators/overview') return overviewPromise;
        return Promise.resolve(fail('unexpected'));
      }),
      post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
    };
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    const renderPromise = page.render();
    expect(page.element.textContent).toContain('Carregando');

    resolveOverview(ok(emptyOverview));
    await renderPromise;
    expect(page.element.textContent).not.toContain('Carregando');
  });

  it('renders a subject choice, not a fabricated percentage, for insufficient history', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: { recommendation: null, mastery: [{ subject: 'Matemática', answered_count: 3, accuracy: null, status: 'insufficient', action: 'choose_subject' }], active_sessions: [] },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    expect(page.element.textContent).toContain('Escolha uma matéria para começar');
    expect(page.element.textContent).not.toContain('0%');
  });

  it('renders the recommended practice hero with subject, sample size and accuracy as evidence', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        recommendation: { subject: 'Matemática', topic: null, answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' },
        mastery: [{ subject: 'Matemática', answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' }],
        active_sessions: [],
      },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    expect(page.element.textContent).toContain('Matemática');
    expect(page.element.textContent).toContain('8');
    expect(page.element.textContent).toContain('42.5%');
    expect(page.element.textContent).toContain('Começar prática');
  });

  it('shows a disabled catalog CTA and no metrics when no questions are published', async () => {
    const api = mockApi({ catalog: emptyCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    const cta = page.element.querySelector('[data-action="browse-catalog"]');
    expect(cta).not.toBeNull();
    expect(cta.disabled).toBe(true);
    expect(page.element.textContent).not.toContain('%');
  });

  it('shows a resume row with progress and remaining time for the active session', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        recommendation: null,
        mastery: [],
        active_sessions: [{
          id: 'active-1', kind: 'practice', status: 'active', subject: 'Matemática', topic: null,
          question_limit: 10, time_limit_seconds: 1500, current_position: 3, elapsed_seconds: 300,
          answered_count: 4, updated_at: '2026-09-22 10:00:00',
        }],
      },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    const resumeButton = page.element.querySelector('[data-action="resume"]');
    expect(resumeButton).not.toBeNull();
    expect(resumeButton.tagName).toBe('BUTTON');
    expect(page.element.querySelector('.simulators-resume').textContent).toContain('4');
  });

  it('pluralizes correctly when more than one other session is in progress', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        recommendation: null,
        mastery: [],
        active_sessions: [
          { id: 'a', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 0, answered_count: 0, updated_at: '2026-09-22 10:00:00' },
          { id: 'b', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 0, answered_count: 0, updated_at: '2026-09-21 10:00:00' },
          { id: 'c', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 0, answered_count: 0, updated_at: '2026-09-20 10:00:00' },
        ],
      },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    expect(page.element.querySelector('.simulators-resume-other').textContent).toContain('2 outras sessões em andamento');
    expect(page.element.textContent).not.toContain('sessãoões');
  });

  it('shows the specific server message when resuming a session fails, and clears it after the next success', async () => {
    let sessionCallCount = 0;
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        recommendation: null,
        mastery: [],
        active_sessions: [{ id: 'stale-1', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 0, answered_count: 0, updated_at: '2026-09-22 10:00:00' }],
      },
    });
    api.get.mockImplementation((url) => {
      if (url === '/simulators/catalog') return Promise.resolve(ok(oneSubjectCatalog));
      if (url === '/simulators/overview') return Promise.resolve(ok({ recommendation: null, mastery: [], active_sessions: [{ id: 'stale-1', subject: 'Matemática', topic: null, question_limit: 10, time_limit_seconds: 1500, elapsed_seconds: 0, answered_count: 0, updated_at: '2026-09-22 10:00:00' }] }));
      if (url === '/simulators/sessions/stale-1') {
        sessionCallCount += 1;
        return Promise.resolve(fail('Sessão não encontrada.'));
      }
      return Promise.resolve(fail(`unexpected GET ${url}`));
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-action="resume"]').click();
    await vi.waitFor(() => expect(sessionCallCount).toBe(1));
    await vi.waitFor(() => expect(page.element.textContent).toContain('Sessão não encontrada.'));
    expect(page.element.querySelector('[data-action="retry"]')).toBeNull();

    page.element.querySelector('[data-action="choose-subject"]').click();

    await vi.waitFor(() => expect(page.element.textContent).not.toContain('Sessão não encontrada.'));
    expect(api.post).toHaveBeenCalled();
  });

  it('creates a practice session from the hero CTA and opens it in the player', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: emptyOverview,
      onCreateSession: (body) => activeSession({ id: 'created-1', kind: body.kind }),
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-action="choose-subject"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());

    expect(api.post).toHaveBeenCalledWith('/simulators/sessions', expect.objectContaining({ kind: 'practice', subjects: ['Matemática'] }));
    expect(page.element.querySelector('.question-text').textContent).toBe('Enunciado 5');
    page.destroy();
  });

  it('shows the specific server message when creating a session fails, without a generic retry banner', async () => {
    const api = {
      get: vi.fn((url) => {
        if (url === '/simulators/catalog') return Promise.resolve(ok(oneSubjectCatalog));
        if (url === '/simulators/overview') return Promise.resolve(ok(emptyOverview));
        return Promise.resolve(fail('unexpected'));
      }),
      post: vi.fn(() => Promise.resolve(fail('Não há questões publicadas suficientes para esta seleção.'))),
      patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
    };
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-field="subject"]').value = 'Matemática';
    page.element.querySelector('[data-action="choose-subject"]').click();
    await vi.waitFor(() => expect(page.element.textContent).toContain('Não há questões publicadas suficientes para esta seleção.'));

    expect(page.element.querySelector('[data-action="retry"]')).toBeNull();
    expect(page.element.textContent).toContain('Matemática (10)');
  });

  it('builds a custom session from several chosen subjects and a question count', async () => {
    const api = mockApi({ catalog: fullCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    for (const box of page.element.querySelectorAll('[data-field="custom-subject"]')) box.checked = true;
    page.element.querySelector('[data-field="custom-count"]').value = '15';
    page.element.querySelector('[data-action="build-custom"]').click();

    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/simulators/sessions', { kind: 'custom', subjects: ['Matemática', 'Psicologia'], count: 15 }));
    page.destroy();
  });

  it('asks for a subject before building a custom session', async () => {
    const api = mockApi({ catalog: fullCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-action="build-custom"]').click();

    await vi.waitFor(() => expect(page.element.textContent).toContain('Escolha ao menos uma matéria.'));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('lists ENEM and concursos exams and starts one as a catalog session', async () => {
    const api = mockApi({
      catalog: fullCatalog,
      overview: emptyOverview,
      onCreateSession: (body) => activeSession({ id: 'catalog-1', kind: body.kind }),
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    const groups = [...page.element.querySelectorAll('.exams-catalog-group h3')].map((heading) => heading.textContent);
    expect(groups).toEqual(['ENEM', 'Concursos']);
    expect(page.element.textContent).toContain('Concursos — Psicologia');
    expect(page.element.textContent).toContain('45 questões · 135 min');

    page.element.querySelector('[data-action="start-catalog"][data-catalog-id="enem:mat"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());
    expect(api.post).toHaveBeenCalledWith('/simulators/sessions', { kind: 'catalog', catalog_id: 'enem:mat' });
    page.destroy();
  });

  it('keeps the previously rendered content when a refresh fails', async () => {
    let overviewCallCount = 0;
    const api = {
      get: vi.fn((url) => {
        if (url === '/simulators/catalog') return Promise.resolve(ok(oneSubjectCatalog));
        if (url === '/simulators/overview') {
          overviewCallCount += 1;
          if (overviewCallCount === 1) {
            return Promise.resolve(ok({
              recommendation: { subject: 'Matemática', topic: null, answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' },
              mastery: [], active_sessions: [],
            }));
          }
          return Promise.resolve(fail('Falha de rede'));
        }
        return Promise.resolve(fail('unexpected'));
      }),
      post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
    };
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();
    expect(page.element.textContent).toContain('Matemática');

    await page.load({ isRefresh: true });

    expect(page.element.textContent).toContain('Matemática');
    expect(page.element.textContent).toContain('42.5%');
    expect(page.element.querySelector('[data-action="retry"]')).not.toBeNull();
  });

  it('renders CTAs as real, keyboard-accessible buttons', async () => {
    const api = mockApi({ catalog: oneSubjectCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    const cta = page.element.querySelector('[data-action="choose-subject"]');
    expect(cta.tagName).toBe('BUTTON');
    expect(cta.type).toBe('button');
    expect(cta.disabled).toBe(false);
  });

  it('reopens the same catalog when practicing a finished exam again', async () => {
    const session = activeSession({ id: 'catalog-1', kind: 'catalog' });
    const completed = { ...session, status: 'completed', questions: session.questions.map((question) => ({ ...question, correct_option: 'A' })) };
    const api = mockApi({ catalog: fullCatalog, overview: emptyOverview, onCreateSession: () => session });
    api.patch.mockResolvedValue(ok({ session }));
    const post = api.post.getMockImplementation();
    api.post.mockImplementation((url, body) => (
      url === '/simulators/sessions/catalog-1/complete'
        ? Promise.resolve(ok({ session: completed, result: { correct: 0, incorrect: 0, unanswered: 2, score: 0 } }))
        : post(url, body)
    ));
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();
    page.element.querySelector('[data-action="start-catalog"][data-catalog-id="enem:mat"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());
    await page.player.finish();
    await vi.waitFor(() => expect(page.element.querySelector('.results-screen')).not.toBeNull());

    page.element.querySelector('.results-screen [data-action="retry"]').click();

    await vi.waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/simulators/sessions')).toHaveLength(2));
    expect(api.post).toHaveBeenLastCalledWith('/simulators/sessions', { kind: 'catalog', catalog_id: 'enem:mat' });
    page.destroy();
  });

  it('does not mention the local library', async () => {
    const api = mockApi({ catalog: oneSubjectCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    expect(page.element.textContent.toLowerCase()).not.toContain('biblioteca local');
  });

  it('resumes an active session at its saved position', async () => {
    const session = activeSession({ current_position: 1, answers: [{ question_id: 7, selected_option: 'B', flagged: false }] });
    const api = mockApi({ catalog: oneSubjectCatalog, overview: { ...emptyOverview, active_sessions: [summaryOf(session)] } });
    const get = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url === `/simulators/sessions/${session.id}` ? Promise.resolve(ok({ session })) : get(url)));
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-action="resume"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());

    expect(page.element.querySelector('.question-text').textContent).toBe('Enunciado 7');
    expect(page.element.querySelector('.question-answer.selected .question-answer-letter').textContent).toBe('B');
    page.destroy();
  });

  it('completes through the API, shows the confirmed result and reloads the overview', async () => {
    const session = activeSession();
    const completed = {
      ...session,
      status: 'completed',
      questions: session.questions.map((question) => ({ ...question, correct_option: 'A' })),
      answers: [{ question_id: 5, selected_option: 'A', flagged: false, is_correct: true }],
    };
    const result = { correct: 1, incorrect: 0, unanswered: 1, score: 50.0 };
    const api = mockApi({ catalog: oneSubjectCatalog, overview: emptyOverview, onCreateSession: () => session });
    api.patch.mockResolvedValue(ok({ session }));
    const post = api.post.getMockImplementation();
    api.post.mockImplementation((url, body) => (
      url === `/simulators/sessions/${session.id}/complete` ? Promise.resolve(ok({ session: completed, result })) : post(url, body)
    ));
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();
    page.element.querySelector('[data-action="choose-subject"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());
    const overviewCallsBefore = api.get.mock.calls.filter(([url]) => url === '/simulators/overview').length;

    await page.player.finish();
    await vi.waitFor(() => expect(page.element.querySelector('.results-screen')).not.toBeNull());

    expect(api.patch).toHaveBeenCalledWith(`/simulators/sessions/${session.id}/progress`, expect.objectContaining({ position: 0 }));
    expect(page.element.textContent).toContain('50%');
    expect(api.post).not.toHaveBeenCalledWith('/exams/attempt', expect.anything());
    await vi.waitFor(() => {
      expect(api.get.mock.calls.filter(([url]) => url === '/simulators/overview').length).toBeGreaterThan(overviewCallsBefore);
    });
    expect(page.element.querySelector('.results-screen')).not.toBeNull();

    page.element.querySelector('[data-action="review"]').click();
    expect(page.element.querySelector('.question-answer.correct')).not.toBeNull();
    page.element.querySelector('[data-action="exit"]').click();
    page.element.querySelector('[data-action="back"]').click();
    await vi.waitFor(() => expect(page.element.querySelector('.simulators-hero')).not.toBeNull());
    page.destroy();
  });
});

function activeSession(overrides = {}) {
  return {
    id: 'session-1',
    kind: 'practice',
    status: 'active',
    subject: 'Matemática',
    topic: null,
    question_limit: 2,
    time_limit_seconds: 1500,
    current_position: 0,
    elapsed_seconds: 0,
    questions: [5, 7].map((id, position) => ({
      id, position, subject: 'Matemática', topic: null, statement: `Enunciado ${id}`,
      options: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' }, images: [],
    })),
    answers: [],
    result: null,
    ...overrides,
  };
}

function summaryOf(session) {
  return {
    id: session.id, kind: session.kind, status: session.status, subject: session.subject, topic: session.topic,
    question_limit: session.question_limit, time_limit_seconds: session.time_limit_seconds,
    current_position: session.current_position, elapsed_seconds: session.elapsed_seconds,
    answered_count: session.answers.length, updated_at: '2026-09-23 10:00:00',
  };
}
