import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const file = resolve(root, 'content/enem/reference-groups.json');
const data = JSON.parse(readFileSync(file, 'utf-8'));

describe('ENEM shared reference groups', () => {
  it('keeps the explicit official groups versioned and traceable', () => {
    expect(data.schema).toBe('bsestudos.enem-reference-groups.v1');
    expect(data.groups).toHaveLength(13);
    for (const group of data.groups) {
      expect(group.confidence).toBe('explicit_official_label');
      expect(group.question_numbers.length).toBeGreaterThanOrEqual(2);
      expect(group.source_pdf).toMatch(/\.pdf$/);
      expect(group.source_pages.length).toBeGreaterThan(0);
      expect(group.body || group.images.length).toBeTruthy();
    }
  });

  it('has every visual reference asset physically available', () => {
    for (const group of data.groups) {
      for (const image of group.images) {
        expect(existsSync(resolve(root, 'content/enem', image)), image).toBe(true);
      }
    }
  });

  it('covers the known 2009 shared stimuli that previously lost context', () => {
    const ids = new Set(data.groups.map((group) => group.id));
    expect(ids.has('enem:2009:d2:q97-98')).toBe(true);
    expect(ids.has('enem:2009:d2:q101-102')).toBe(true);
    expect(ids.has('enem:2009:d2:q107-108')).toBe(true);
    expect(ids.has('enem:2009:d2:q117-118')).toBe(true);
    expect(ids.has('enem:2010:d1:q5-6')).toBe(true);
    expect(ids.has('enem:2011:d2:q133-134')).toBe(true);
    expect(ids.has('enem:2025:d1:q6-10')).toBe(true);
    expect(ids.has('enem:2010:d2:q91-92')).toBe(false);
  });
});
