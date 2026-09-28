import { describe, expect, it, vi } from 'vitest';
import { SimulatorAdminPage } from '../pages/SimulatorAdminPage.js';

function adminApi() {
  const overview = {
    success: true,
    data: {
      stats: { published_questions: 10, valid_enem: 8, pending_enem: 2, published_catalogs: 1, catalog_replacements: 2, reference_groups: 0 },
      reference_groups: [],
      reference_candidates: [{ id: 'inep:1', subject: 'Linguagens', topic: null, statement_preview: 'De acordo com o texto...' }],
    },
  };
  const audit = {
    success: true,
    data: {
      items: [{
        id: 'inep:1', source: 'enem', status: 'valid', year: 2024, day: 1, question_number: 1,
        subject: 'Linguagens', topic: 'Interpretação',
        statement: 'ENEM2024ENEM2024ENEM2024 Leia o texto e responda.',
        presentation_statement: 'Leia o texto e responda.',
        options: { A: 'A\t Alfa', B: 'B\t Beta', C: 'C\t Gama', D: 'D\t Delta', E: 'E\t Épsilon' },
        presentation_options: { A: 'Alfa', B: 'Beta', C: 'Gama', D: 'Delta', E: 'Épsilon' },
        correct_option: 'B', quality_status: 'approved', quality_reason: null,
        quality_flags: ['presentation_watermark', 'embedded_option_labels'],
        images: ['/question-assets/enem/teste.png'], source_pdf: 'enem.pdf', source_page: 4, source_pages: [4],
        pending_reason: null, provider: null, source_meta: {}, reference: { id: 'ref-1', title: 'Texto I' },
      }],
      pagination: { page: 1, per_page: 20, total: 1, pages: 1 },
      filters: { subjects: ['Linguagens'], years: [2024] },
    },
  };
  return {
    get: vi.fn((endpoint) => Promise.resolve(endpoint.startsWith('/admin/simulators/questions') ? audit : overview)),
    post: vi.fn().mockResolvedValue({ success: true, data: { id: 'ref-1' } }),
  };
}

describe('SimulatorAdminPage', () => {
  it('renders the question audit with source, answer and reference metadata', async () => {
    const api = adminApi();
    const element = await new SimulatorAdminPage({ api, user: { id: 1, role: 'admin' } }).render();

    expect(element.textContent).toContain('Auditoria do banco de questões');
    expect(element.textContent).toContain('inep:1');
    expect(element.textContent).toContain('2024');
    expect(element.textContent).toContain('Texto-base vinculado');
    expect(element.querySelector('.simulator-audit-options li.correct').textContent).toContain('B) Beta');
    expect(element.querySelectorAll('.simulator-audit-images img')).toHaveLength(1);
    expect(element.querySelector('.simulator-audit-statement').textContent).toBe('Leia o texto e responda.');
    expect(element.textContent).toContain('Marca-d’água removida na prévia');
    expect(element.textContent).toContain('Rótulos A–E normalizados');
    expect(element.querySelector('.simulator-audit-raw')).not.toBeNull();
    expect(element.querySelector('.simulator-audit-raw').textContent).toContain('ENEM2024ENEM2024ENEM2024');
    expect(element.textContent).toContain('Substituições seguras');
  });

  it('applies audit filters through the admin endpoint', async () => {
    const api = adminApi();
    const page = new SimulatorAdminPage({ api, user: { id: 1, role: 'admin' } });
    const element = await page.render();
    const form = element.querySelector('.simulator-audit-filters');
    form.elements.q.value = 'fotossíntese';
    form.elements.source.value = 'enem';
    form.elements.status.value = 'pending';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.get.mock.calls.some(([endpoint]) =>
      endpoint.includes('/admin/simulators/questions?') &&
      endpoint.includes('q=fotoss%C3%ADntese') &&
      endpoint.includes('source=enem') &&
      endpoint.includes('status=pending')
    )).toBe(true);
  });

  it('loads real admin data and creates a reference group', async () => {
    const api = adminApi();
    const page = new SimulatorAdminPage({ api, user: { id: 1, role: 'admin' } });
    const element = await page.render();

    element.querySelector('[name="title"]').value = 'Texto I';
    element.querySelector('[name="body"]').value = 'Texto-base';
    element.querySelector('[name="question_id"]').checked = true;
    element.querySelector('.simulator-reference-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
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
