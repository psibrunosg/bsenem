import { describe, expect, it } from 'vitest';
import { TranscriptPanel } from '../components/TranscriptPanel.js';

describe('TranscriptPanel', () => {
  it('filters a text transcript without changing its source', () => {
    const panel = new TranscriptPanel({ text: 'Sistema nervoso central' });
    const element = panel.render();
    panel.setQuery('nervoso');

    expect(element.textContent).toContain('Sistema nervoso central');
    expect(panel.text).toBe('Sistema nervoso central');
  });

  it('shows an empty result for a query that does not occur', () => {
    const panel = new TranscriptPanel({ text: 'Sistema nervoso central' });
    const element = panel.render();
    panel.setQuery('química');

    expect(element.textContent).toContain('Nenhum trecho encontrado.');
  });
});
