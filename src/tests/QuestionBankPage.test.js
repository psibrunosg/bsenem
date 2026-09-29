import { describe, expect, it, vi } from 'vitest';
import { ExamsPage } from '../pages/ExamsPage.js';

const ok = (data) => ({ success: true, data });

describe('question bank builder', () => {
  it('loads the ENEM and Concursos entry choices inside the current ExamsPage flow', async () => {
    const api = {
      get: vi.fn((url) => {
        if (url === '/simulators/catalog') return Promise.resolve(ok({ subjects: [], catalogs: [] }));
        if (url === '/simulators/overview') return Promise.resolve(ok({ recommendation: null, mastery: [], active_sessions: [] }));
        if (url === '/question-bank/facets') return Promise.resolve(ok({
          tracks: [
            { slug: 'enem', label: 'ENEM', count: 2337 },
            { slug: 'concursos', label: 'Concursos', count: 2449 }
          ],
          subjects: [], specialties: [], topics: []
        }));
        return Promise.resolve({ success: false, message: `unexpected GET ${url}` });
      }),
      post: vi.fn(), patch: vi.fn()
    };

    const page = new ExamsPage({ user: { id: 7, name: 'Estudante' }, apiClient: api });
    const element = await page.render();

    await vi.waitFor(() => expect(element.querySelector('[data-question-bank-track]')).not.toBeNull());
    const options = [...element.querySelector('[data-question-bank-track]').options].map((option) => option.textContent);

    expect(options).toEqual(expect.arrayContaining(['ENEM (2337)', 'Concursos (2449)']));
    expect(element.textContent).toContain('Banco de questões');
  });
});
