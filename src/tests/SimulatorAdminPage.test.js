import { describe, expect, it, vi } from 'vitest';
import { SimulatorAdminPage } from '../pages/SimulatorAdminPage.js';

describe('SimulatorAdminPage', () => {
  it('loads real admin data and creates a reference group', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          stats: { published_questions: 10, valid_enem: 8, pending_enem: 2, published_catalogs: 1, reference_groups: 0 },
          reference_groups: [],
          reference_candidates: [{ id: 'inep:1', subject: 'Linguagens', topic: null, statement_preview: 'De acordo com o texto...' }],
        },
      }),
      post: vi.fn().mockResolvedValue({ success: true, data: { id: 'ref-1' } }),
    };
    const page = new SimulatorAdminPage({ api, user: { id: 1, role: 'admin' } });
    const element = await page.render();

    element.querySelector('[name="title"]').value = 'Texto I';
    element.querySelector('[name="body"]').value = 'Texto-base';
    element.querySelector('[name="question_id"]').checked = true;
    element.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.get).toHaveBeenCalledWith('/admin/simulators');
    expect(api.post).toHaveBeenCalledWith('/admin/simulators/reference-groups', {
      title: 'Texto I', body: 'Texto-base', question_ids: ['inep:1'],
    });
  });

  it('does not load administration for a regular user', async () => {
    const api = { get: vi.fn() };
    const element = await new SimulatorAdminPage({ api, user: { id: 1, role: 'student' } }).render();
    expect(element.textContent).toContain('Acesso administrativo');
    expect(api.get).not.toHaveBeenCalled();
  });
});
