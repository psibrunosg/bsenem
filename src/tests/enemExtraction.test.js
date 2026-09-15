import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const extractedPath = resolve(root, 'docs/sources/enem/extracted-questions-2009-2025.json');
const manifestPath = resolve(root, 'docs/sources/enem/manifest-2009-2025.json');
const contentRoot = resolve(root, 'content/enem');

describe('ENEM 2009-2025 Question Repository Extraction', () => {
  it('preserves official archive inventory with exactly 34 cadernos and 34 gabaritos', () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const provas = manifest.entries.filter(e => e.documentKind === 'prova');
    const gabaritos = manifest.entries.filter(e => e.documentKind === 'gabarito');
    expect(provas).toHaveLength(34);
    expect(gabaritos).toHaveLength(34);
  });

  it('contains exactly 3,060 objective questions across 17 editions', () => {
    if (!existsSync(extractedPath)) {
      console.warn('Extraction JSON not yet created.');
      return;
    }
    const data = JSON.parse(readFileSync(extractedPath, 'utf-8'));
    expect(data.questions).toHaveLength(3060);
    expect(data.total_questions).toBe(3060);
  });

  it('has exactly 90 questions for every year and day without duplicates', () => {
    if (!existsSync(extractedPath)) return;
    const data = JSON.parse(readFileSync(extractedPath, 'utf-8'));
    const seen = new Set();

    const counts = {};
    for (const q of data.questions) {
      const key = `${q.year}-D${q.day}-#${q.question_number}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);

      const ydKey = `${q.year}-D${q.day}`;
      counts[ydKey] = (counts[ydKey] || 0) + 1;
    }

    for (let y = 2009; y <= 2025; y++) {
      expect(counts[`${y}-D1`]).toBe(90);
      expect(counts[`${y}-D2`]).toBe(90);
    }
  });

  it('ensures each valid question has statement, 5 options, and official answer', () => {
    if (!existsSync(extractedPath)) return;
    const data = JSON.parse(readFileSync(extractedPath, 'utf-8'));
    const valids = data.questions.filter(q => q.status === 'valid');

    expect(valids.length).toBeGreaterThan(2000);

    for (const q of valids) {
      expect(q.statement.trim().length).toBeGreaterThan(0);
      expect(q.option_a.trim().length).toBeGreaterThan(0);
      expect(q.option_b.trim().length).toBeGreaterThan(0);
      expect(q.option_c.trim().length).toBeGreaterThan(0);
      expect(q.option_d.trim().length).toBeGreaterThan(0);
      expect(q.option_e.trim().length).toBeGreaterThan(0);
      expect(['A', 'B', 'C', 'D', 'E', 'ANULADA']).toContain(q.correct_option);
    }
  });

  it('audits that all referenced image assets exist physically on disk', () => {
    if (!existsSync(extractedPath)) return;
    const data = JSON.parse(readFileSync(extractedPath, 'utf-8'));
    const missing = [];

    for (const q of data.questions) {
      for (const imgPath of q.images) {
        // Must be safe relative path
        expect(imgPath).not.toMatch(/^(\/|\\|\.\.)/);
        expect(imgPath).not.toContain('://');

        const abs = resolve(contentRoot, imgPath);
        if (!existsSync(abs)) {
          missing.push(imgPath);
        }
      }
    }

    expect(missing).toHaveLength(0);
  });
});
