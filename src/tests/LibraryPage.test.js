import { describe, expect, it, vi } from 'vitest';
import { LibraryPage } from '../pages/LibraryPage.js';

const item = (overrides = {}) => ({
  id: 'video-1', title: 'Funcoes', area: 'Matematica', collection: 'Modulo 1', resourceType: 'video', ...overrides
});

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
    await vi.waitFor(() => expect(element.textContent).toContain('Nova aula'));
    expect(library.connect).toHaveBeenCalledOnce();
  });

  it('groups resources by area and collection', async () => {
    const page = new LibraryPage({ library: { items: [item(), item({ id: 'pdf-1', title: 'Resumo', resourceType: 'pdf' })] } });
    const element = await page.render();

    expect(element.textContent).toContain('Matematica');
    expect(element.textContent).toContain('Modulo 1');
    expect(element.textContent).toContain('Funcoes');
    expect(element.textContent).toContain('Resumo');
  });

  it('opens a selected video through the app resource bridge', async () => {
    const openLocalResource = vi.fn();
    const page = new LibraryPage({ app: { openLocalResource }, library: { items: [item()] } });
    const element = await page.render();

    element.querySelector('[data-resource-id="video-1"]').click();

    expect(openLocalResource).toHaveBeenCalledWith(item());
  });
});
