import { describe, it, expect, beforeEach } from 'vitest';
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
});
