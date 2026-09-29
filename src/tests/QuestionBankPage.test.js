import { describe, expect, it, vi } from 'vitest';
import { ExamsPage } from '../pages/ExamsPage.js';

const user = { id: 7, name: 'Estudante' };

describe('question bank builder', () => {
  it('loads the ENEM and Concursos entry choices before local exams', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          tracks: [
            { slug: 'enem', label: 'ENEM', count: 2337 },
            { slug: 'concursos', label: 'Concursos', count: 2449 }
          ],
          subjects: [], specialties: [], topics: []
        }
      })
    };
    const page = new ExamsPage({ user, apiClient: api });
    const element = page.render();

    await vi.waitFor(() => expect(element.querySelector('[data-question-bank-track]')).not.toBeNull());

    const options = [...element.querySelector('[data-question-bank-track]').options].map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['ENEM (2337)', 'Concursos (2449)']));
    expect(element.textContent).toContain('Banco de questões');
  });
});
