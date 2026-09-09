import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotesPage } from '../pages/NotesPage.js';

describe('NotesPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders saved note metadata as text instead of HTML', () => {
    const page = new NotesPage();
    page.notes = [{
      id: 'note_1',
      title: '<img src=x onerror=alert(1)>',
      content: '<img src=x onerror=alert(1)>',
      tags: ['<img src=x onerror=alert(1)>'],
      updatedAt: new Date().toISOString()
    }];

    const element = page.render();

    expect(element.querySelectorAll('.notes-list img')).toHaveLength(0);
    expect(element.querySelector('.notes-list').textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('opens an existing note when the learner selects it from the list', () => {
    const page = new NotesPage();
    page.loadNotes = async () => {};
    page.notes = [{ id: 'note_1', title: 'Feynman: Fotossíntese', content: 'Explicação simples', tags: ['feynman'], updatedAt: new Date().toISOString() }];
    const element = page.render();

    element.querySelector('.notes-list-item').click();

    expect(page.currentNote.id).toBe('note_1');
    expect(element.querySelector('.editor-textarea')).not.toBeNull();
  });

  it('shows an error instead of a success message when saving a note fails', async () => {
    const page = new NotesPage();
    page.loadNotes = async () => {};
    page.notes = [{ id: 'note_1', title: 'Rascunho', content: 'Texto', tags: [] }];
    page.render();
    page.currentNote = page.notes[0];
    page.saveNotes = vi.fn().mockResolvedValue(false);
    page.showToast = vi.fn();

    await page.handleSave({ title: 'Rascunho', content: 'Texto', tags: [], wikiLinks: [] });

    expect(page.showToast).toHaveBeenCalledWith('Não foi possível salvar a nota.');
  });

  it('does not leave an unsaved Feynman template pretending to be a saved note', async () => {
    const page = new NotesPage();
    page.loadNotes = async () => {};
    page.render();
    page.saveNotes = vi.fn().mockResolvedValue(false);
    page.showToast = vi.fn();

    await page.createFeynmanNote();

    expect(page.notes).toEqual([]);
    expect(page.currentNote).toBeNull();
    expect(page.showToast).toHaveBeenCalledWith('Não foi possível criar o roteiro Feynman.');
  });
});
