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
const oneSubjectCatalog = { subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }] };
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

  it('creates a practice session from the hero CTA and refreshes the home', async () => {
    let created = false;
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        get recommendation() {
          return created ? { subject: 'Matemática', topic: null, answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' } : null;
        },
        mastery: [],
        active_sessions: [],
      },
      onCreateSession: (body) => { created = true; return { id: 'created-1', kind: body.kind, subject: 'Matemática' }; },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    page.element.querySelector('[data-action="choose-subject"]').click();
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/simulators/sessions', expect.objectContaining({ kind: 'practice' })));

    expect(api.get).toHaveBeenCalledWith('/simulators/overview');
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

  it('creates a custom session from the secondary catalog for a chosen subject', async () => {
    const api = mockApi({
      catalog: oneSubjectCatalog,
      overview: {
        recommendation: { subject: 'Matemática', topic: null, answered_count: 8, accuracy: 42.5, status: 'attention', action: 'practice' },
        mastery: [],
        active_sessions: [],
      },
    });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });
    await page.render();

    const subjectButton = page.element.querySelector('[data-action="browse-subject"][data-subject="Matemática"]');
    expect(subjectButton).not.toBeNull();
    subjectButton.click();

    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/simulators/sessions', expect.objectContaining({ kind: 'custom', subjects: ['Matemática'] })));
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

  it('does not mention the local library', async () => {
    const api = mockApi({ catalog: oneSubjectCatalog, overview: emptyOverview });
    const page = new ExamsPage({ apiClient: api, user: { id: 'u1' } });

    await page.render();

    expect(page.element.textContent.toLowerCase()).not.toContain('biblioteca local');
  });
});
