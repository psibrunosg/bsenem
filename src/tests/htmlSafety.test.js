import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell.js';
import { Header } from '../components/Header.js';
import { Flashcard } from '../components/Flashcard.js';
import { FlashcardManager } from '../components/FlashcardManager.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { ExamPlayer } from '../components/ExamPlayer.js';
import { MarkdownEditor } from '../components/MarkdownEditor.js';
import { Sidebar } from '../components/Sidebar.js';

const unsafeName = '<img src=x onerror="globalThis.pwned=true">Bruno';
const user = { id: 1, name: unsafeName, email: 'unsafe@example.test', level: 1, xp: 0, xpMax: 1000, streak: 0 };

describe('dynamic HTML safety', () => {
  it('renders authenticated profile fields as text in navigation components', () => {
    const sidebar = new Sidebar({ user }).render();
    const header = new Header({ user }).render();

    expect(sidebar.querySelector('img')).toBeNull();
    expect(header.querySelector('img')).toBeNull();
    expect(sidebar.querySelector('.user-name').textContent).toBe(unsafeName);
    expect(header.querySelector('.user-menu-name').textContent).toBe(unsafeName);
  });

  it('escapes search result fields while preserving visible highlighting', () => {
    const header = new Header({
      user: { ...user, name: 'Bruno' },
      searchResults: [{
        category: '<img src=x onerror=1>Notas',
        title: '<img src=x onerror=1>Álgebra',
        meta: '<svg onload=1>Resumo',
        route: 'notes" onclick="globalThis.pwned=true',
        id: '1" autofocus',
        icon: 'search" onload="globalThis.pwned=true'
      }]
    });
    const element = header.render();
    element.querySelector('[data-action="search-input"]').value = 'Álgebra';

    header.renderSearchResults();

    expect(element.querySelector('.search-results img')).toBeNull();
    expect(element.querySelector('.search-results svg')).toBeNull();
    expect(element.querySelector('[onclick], [onload], [autofocus]')).toBeNull();
    expect(element.querySelector('.search-result-title mark').textContent).toBe('Álgebra');
  });

  it('escapes route errors before inserting them into the shell', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    class BrokenRoute {
      render() { throw new Error('<img src=x onerror=1>Falha privada'); }
    }
    const app = new AppShell({ user: { ...user, name: 'Bruno' } });
    const element = app.render();
    app.registerRoute('broken', BrokenRoute);

    await app.renderRoute('broken');

    expect(element.querySelector('.app-content img')).toBeNull();
    expect(element.querySelector('.app-content').textContent).toContain('<img src=x onerror=1>Falha privada');
    consoleError.mockRestore();
  });

  it('keeps note titles and tags inside their intended fields', () => {
    const title = '" autofocus onfocus="globalThis.pwned=true';
    const tag = '"><img src=x onerror=1>';
    const element = new MarkdownEditor({ title, tags: [tag] }).render();

    expect(element.querySelector('.editor-title-input').value).toBe(title);
    expect(element.querySelector('[autofocus], [onfocus]')).toBeNull();
    expect(element.querySelector('.editor-tags-list img')).toBeNull();
    expect(element.querySelector('.editor-tag').textContent).toContain(tag);
  });

  it('renders persisted flashcard content as text in lists and reviews', () => {
    const card = { id: '7" onclick="globalThis.pwned=true', front: unsafeName, back: '<svg onload=1>Resposta', subject: '', interval: 1, easeFactor: 2.5, tags: [] };
    const manager = new FlashcardManager({ cards: [card] }).render();
    const review = new Flashcard({ card }).render();

    expect(manager.querySelector('img, svg[onload], [onclick]')).toBeNull();
    expect(review.querySelector('img, svg[onload]')).toBeNull();
    expect(manager.querySelector('.flashcard-item-front').textContent).toBe(unsafeName);
    expect(review.querySelector('.flashcard-text').textContent).toBe(unsafeName);
  });

  it('renders imported exam content as text without executable attributes', () => {
    const question = {
      id: 'q1', text: unsafeName, answers: ['<svg onload=1>Alternativa'],
      correctAnswer: 0, explanation: '<img src=x onerror=1>Explicação', source: '<iframe srcdoc=x>Fonte'
    };
    const card = new QuestionCard({ question, showExplanation: true }).render();
    const exam = new ExamPlayer({ session: {
      id: 's1', kind: 'custom', status: 'active', subject: unsafeName, topic: '<svg onload=1>Tópico',
      time_limit_seconds: 60, current_position: 0, elapsed_seconds: 0, answers: [],
      questions: [{ id: 1, statement: unsafeName, options: { A: '<svg onload=1>Alternativa', B: 'b', C: 'c', D: 'd', E: 'e' }, images: [] }],
    } }).render();

    expect(card.querySelector('img, svg[onload], iframe, [onerror]')).toBeNull();
    expect(exam.querySelector('img, svg[onload], iframe, [onerror]')).toBeNull();
    expect(card.querySelector('.question-text').textContent).toBe(unsafeName);
    expect(exam.querySelector('.exam-subject').textContent).toBe(`${unsafeName} · <svg onload=1>Tópico`);
    expect(exam.querySelector('.question-text').textContent).toBe(unsafeName);
  });
});
