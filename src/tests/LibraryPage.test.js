import { describe, expect, it, vi } from 'vitest';
import { LibraryPage } from '../pages/LibraryPage.js';
import { buildCourseCatalog } from '../services/courseCatalog.js';

const item = (overrides = {}) => ({
  id: 'video-1', title: 'Funcoes', area: 'Matematica', collection: 'Modulo 1', resourceType: 'video', ...overrides
});

function catalogWithPairedLesson() {
  return buildCourseCatalog([
    item({ id: 'video-1', title: 'Aula de funções', rawTitle: 'Aula de funções', pathSegments: ['Curso de matemática', 'Módulo 1', 'Vídeos'] }),
    item({ id: 'audio-1', title: 'Aula de funções', rawTitle: 'Aula de funções', resourceType: 'audio', pathSegments: ['Curso de matemática', 'Módulo 1', 'Áudios'] }),
    item({ id: 'pdf-1', title: 'C4-A3-MC4', rawTitle: 'C4-A3-MC4', resourceType: 'pdf', pathSegments: ['Curso de matemática', 'Módulo 1', 'PDFs'] })
  ]);
}

function libraryWithCatalog(catalog) {
  return {
    items: [
      item({ id: 'video-1', title: 'Aula de funções', rawTitle: 'Aula de funções', pathSegments: ['Curso de matemática', 'Módulo 1', 'Vídeos'] }),
      item({ id: 'audio-1', title: 'Aula de funções', rawTitle: 'Aula de funções', resourceType: 'audio', pathSegments: ['Curso de matemática', 'Módulo 1', 'Áudios'] }),
      item({ id: 'pdf-1', title: 'C4-A3-MC4', rawTitle: 'C4-A3-MC4', resourceType: 'pdf', pathSegments: ['Curso de matemática', 'Módulo 1', 'PDFs'] })
    ],
    catalog
  };
}

describe('LibraryPage', () => {
  it('shows an honest empty state before a folder is connected', async () => {
    const page = new LibraryPage({ library: { items: [] } });
    const element = await page.render();

    expect(element.textContent).toContain('Conectar pasta de estudos');
    expect(element.textContent).not.toMatch(/Joao|Carlos Silva|Simulado ENEM 2023/);
  });

  it('connects the folder after the connect button is clicked', async () => {
    const library = { items: [], connect: vi.fn().mockResolvedValue({ items: [item()] }) };
    const page = new LibraryPage({ library });
    const element = await page.render();

    element.querySelector('[data-action="connect"]').click();
    await vi.waitFor(() => expect(element.textContent).toContain('Funcoes'));

    expect(library.connect).toHaveBeenCalledOnce();
  });

  it('keeps a cancelled picker silent', async () => {
    const library = { items: [], connect: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) };
    const page = new LibraryPage({ library });
    const element = await page.render();

    element.querySelector('[data-action="connect"]').click();
    await Promise.resolve();

    expect(element.textContent).toContain('Conectar pasta de estudos');
    expect(element.textContent).not.toContain('indisponível');
  });

  it('offers reconnect when the stored permission was revoked', async () => {
    const library = { items: [], connect: vi.fn().mockRejectedValue(Object.assign(new Error('permission-denied'), { code: 'permission-denied' })) };
    const page = new LibraryPage({ library });
    const element = await page.render();

    element.querySelector('[data-action="connect"]').click();
    await vi.waitFor(() => expect(element.textContent).toContain('Permissão revogada'));

    expect(element.querySelector('[data-action="connect"]').textContent).toContain('Reconectar');
  });

  it('refreshes a connected library', async () => {
    const library = { items: [item()], refresh: vi.fn().mockResolvedValue({ items: [item()] }) };
    const page = new LibraryPage({ library });
    const element = await page.render();

    element.querySelector('[data-action="refresh"]').click();
    await vi.waitFor(() => expect(library.refresh).toHaveBeenCalledOnce());
  });

  it('lets the user choose another folder from a connected library', async () => {
    const library = { items: [item()], connect: vi.fn().mockResolvedValue({ items: [item({ title: 'Nova aula' })] }) };
    const page = new LibraryPage({ library });
    const element = await page.render();

    const changeFolder = element.querySelector('[data-action="change-folder"]');
    expect(changeFolder?.textContent).toContain('Trocar pasta');

    changeFolder.click();
    await vi.waitFor(() => expect(element.textContent).toContain('Nova Aula'));
    expect(library.connect).toHaveBeenCalledOnce();
  });

  it('resets the browser catalog only after confirmation', async () => {
    const library = { items: [item()], reset: vi.fn().mockResolvedValue() };
    const confirmReset = vi.fn().mockResolvedValue(true);
    const page = new LibraryPage({ library, confirmReset });
    const element = await page.render();

    element.querySelector('[data-action="reset-library"]').click();
    await vi.waitFor(() => expect(library.reset).toHaveBeenCalledOnce());

    expect(confirmReset).toHaveBeenCalledOnce();
    expect(element.textContent).toContain('Conectar pasta de estudos');
  });

  it('organizes resources in the course content module', async () => {
    const page = new LibraryPage({ library: { items: [item(), item({ id: 'pdf-1', title: 'Resumo', resourceType: 'pdf' })] } });
    const element = await page.render();

    expect(element.textContent).toContain('Conteúdos do curso');
    expect(element.textContent).toContain('Funcoes');
    expect(element.textContent).toContain('Resumo');
  });

  it('renders module navigation and one card for paired video and audio', async () => {
    const page = new LibraryPage({ library: libraryWithCatalog(catalogWithPairedLesson()) });
    const element = await page.render();
    const moduleId = 'module:Curso%20de%20matem%C3%A1tica/M%C3%B3dulo%201';

    expect(element.querySelector(`[data-node-id="${moduleId}"]`)).not.toBeNull();
    expect(element.querySelectorAll('[data-lesson-id]').length).toBe(1);
    expect(element.textContent).not.toContain('C4-A3-MC4');
    expect(element.textContent).toContain('Material complementar');
  });

  it('marks a leaf module as not expandable', async () => {
    const page = new LibraryPage({ library: libraryWithCatalog(catalogWithPairedLesson()) });
    const element = await page.render();
    const moduleId = 'module:Curso%20de%20matem%C3%A1tica/M%C3%B3dulo%201';

    expect(element.querySelector(`[data-node-id="${moduleId}"]`)?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps type filters available when the selected module has no PDFs', async () => {
    const video = item({ rawTitle: 'Aula', pathSegments: ['Curso', 'Módulo', 'Vídeos'] });
    const page = new LibraryPage({ library: { items: [video], catalog: buildCourseCatalog([video]) } });
    const element = await page.render();

    element.querySelector('[data-library-filter="pdf"]').click();

    expect(element.textContent).toContain('Não há PDFs neste módulo.');
    expect(element.querySelector('[data-library-filter="video"]')).not.toBeNull();
    expect(element.querySelector('[data-library-filter="pdf"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens a PDF card through the local resource bridge once', async () => {
    const openLocalResource = vi.fn();
    const page = new LibraryPage({ app: { openLocalResource }, library: libraryWithCatalog(catalogWithPairedLesson()) });
    const element = await page.render();

    element.querySelector('[data-resource-id="pdf-1"]').click();

    expect(openLocalResource).toHaveBeenCalledTimes(1);
    expect(openLocalResource).toHaveBeenCalledWith(expect.objectContaining({ id: 'pdf-1', resourceType: 'pdf' }));
  });

  it('opens a selected video through the app resource bridge', async () => {
    const openLocalResource = vi.fn();
    const page = new LibraryPage({ app: { openLocalResource }, library: { items: [item()] } });
    const element = await page.render();

    element.querySelector('[data-resource-id="video-1"]').click();

    expect(openLocalResource).toHaveBeenCalledWith(item());
  });
});
