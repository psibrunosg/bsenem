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

  it('allows starting a second practice after exiting the first in the same page instance', async () => {
    let createdSessions = 0;
    const api = {
      get: vi.fn((url) => {
        if (url === '/simulators/catalog') return Promise.resolve(ok({ subjects: [], catalogs: [] }));
        if (url === '/simulators/overview') return Promise.resolve(ok({ recommendation: null, mastery: [], active_sessions: [] }));
        if (url.startsWith('/question-bank/facets')) return Promise.resolve(ok({
          tracks: [{ slug: 'enem', label: 'ENEM', count: 10 }],
          subjects: [{ slug: 'matematica', label: 'Matemática', count: 10 }],
          specialties: [], topics: []
        }));
        return Promise.resolve({ success: false, message: `unexpected GET ${url}` });
      }),
      post: vi.fn((url) => {
        if (url !== '/question-bank/sessions') return Promise.resolve({ success: false, message: `unexpected POST ${url}` });
        createdSessions += 1;
        return Promise.resolve(ok({
          sessionId: `session-${createdSessions}`,
          title: 'Matemática',
          questions: [{ id: `question-${createdSessions}`, text: 'Quanto é 2 + 2?', answers: ['3', '4', '5', '6', '7'] }]
        }));
      }),
      patch: vi.fn()
    };

    const page = new ExamsPage({ user: { id: 7, name: 'Estudante' }, apiClient: api });
    try {
      await page.render();

      const selectOption = async (selector, value) => {
        const select = page.element.querySelector(selector);
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const selectPractice = async () => {
        await selectOption('[data-question-bank-track]', 'enem');
        await vi.waitFor(() => expect(page.element.querySelector('[data-question-bank-subject] option[value="matematica"]')).not.toBeNull());
        await selectOption('[data-question-bank-subject]', 'matematica');
        await vi.waitFor(() => expect(page.element.querySelector('[data-action="start-question-bank"]').disabled).toBe(false));
      };

      await selectPractice();
      page.element.querySelector('[data-action="start-question-bank"]').click();
      await vi.waitFor(() => expect(page.mode).toBe('player'));
      page.element.querySelector('.exam-player [data-action="exit"]').click();
      await vi.waitFor(() => expect(page.mode).toBe('home'));

      const secondStart = page.element.querySelector('[data-action="start-question-bank"]');
      expect(secondStart.textContent.trim()).toBe('Iniciar prática');
      expect(secondStart.disabled).toBe(false);
      secondStart.click();
      await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(page.element.querySelector('.exam-player')).not.toBeNull());
    } finally {
      page.destroy();
    }
  });
});
