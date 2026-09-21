import { describe, expect, it, vi } from 'vitest';
import { StudyLibraryPage } from '../pages/StudyLibraryPage.js';

describe('StudyLibraryPage', () => {
  it('shows imported items with their own direct Drive link', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({
        success: true,
        data: {
          items: [{
            id: 10,
            name: 'Aula 01 - Nutrição.pdf',
            direct_url: 'https://drive.google.com/file/d/aula-01/view',
            item_type: 'pdf',
            catalog_path: 'Instituições / Faculdade Unifatécie / Nutrição',
          }],
          children: [{ path: 'Instituições', label: 'Instituições', count: 1 }],
          types: { pdf: 1 },
          institution_sections: [{
            label: 'Faculdade Unifatécie',
            path: 'Instituições / Faculdade Unifatécie',
            entries: [{ path: 'Instituições / Faculdade Unifatécie / Nutrição', label: 'Nutrição', count: 1, kind: 'Graduação' }],
          }],
        },
        pagination: { total: 1, page: 1, total_pages: 1 },
      }),
    };

    const page = new StudyLibraryPage({ api });
    const element = await page.render();

    const lesson = element.querySelector('[data-library-item="10"]');
    expect(lesson.textContent).toContain('Aula 01 - Nutrição.pdf');
    lesson.click();
    expect(element.querySelector('.study-library-player iframe')?.src).toBe('https://drive.google.com/file/d/aula-01/preview');
    expect(element.querySelector('.study-library-player a')?.href).toBe('https://drive.google.com/file/d/aula-01/view');
    expect(element.textContent).toContain('Instituições');
    expect(element.querySelector('[data-type="pdf"]')?.textContent).toContain('PDFs');
    expect(element.querySelector('.institution-gallery h2')?.textContent).toBe('Faculdade Unifatécie');
    expect(element.querySelector('.institution-gallery-card')?.textContent).toContain('Nutrição');
    expect(element.querySelector('[data-gallery-scroll="next"]')).not.toBeNull();
  });
});
