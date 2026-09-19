import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { validateLocalExam } from '../services/examSchema.js';

const root = resolve(__dirname, '../..');
const contentRoot = resolve(root, 'content/enem');
const extractedPath = resolve(root, 'docs/sources/enem/extracted-questions-2009-2025.json');
const SUPPORTED_IMAGES = new Set(['.png', '.webp', '.jpg', '.jpeg']);

const simulados = existsSync(contentRoot)
  ? readdirSync(contentRoot).filter(name => name.endsWith('.bsestudos.exam.json'))
  : [];

const read = name => JSON.parse(readFileSync(resolve(contentRoot, name), 'utf-8'));

describe('Simulados gerados a partir da extração oficial', () => {
  it('publica os sete simulados ao lado de content/enem/assets', () => {
    expect(simulados.sort()).toEqual([
      'simulado-ciencias-humanas-45q.bsestudos.exam.json',
      'simulado-ciencias-natureza-45q.bsestudos.exam.json',
      'simulado-dia1-90q.bsestudos.exam.json',
      'simulado-dia2-90q.bsestudos.exam.json',
      'simulado-geral-45q.bsestudos.exam.json',
      'simulado-linguagens-45q.bsestudos.exam.json',
      'simulado-matematica-45q.bsestudos.exam.json'
    ]);
  });

  it.each(simulados)('%s passa no validador do app', name => {
    expect(validateLocalExam(read(name))).toEqual({ valid: true, errors: [] });
  });

  it.each(simulados)('%s tem toda imagem declarada em disco e num formato suportado', name => {
    // O LocalLibraryService recusa o simulado inteiro se uma imagem não resolve.
    for (const question of read(name).questions) {
      for (const image of question.images ?? []) {
        expect(SUPPORTED_IMAGES.has(extname(image).toLowerCase())).toBe(true);
        expect(existsSync(resolve(contentRoot, image))).toBe(true);
      }
    }
  });

  it.each(simulados)('%s não repete questão', name => {
    const ids = read(name).questions.map(question => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('só usa questões com status valid e gabarito oficial A-E', () => {
    const extracted = JSON.parse(readFileSync(extractedPath, 'utf-8'));
    const usable = new Map();
    for (const question of extracted.questions) {
      usable.set(`enem-${question.year}-d${question.day}-q${String(question.question_number).padStart(3, '0')}`, question);
    }

    for (const name of simulados) {
      for (const question of read(name).questions) {
        const source = usable.get(question.id);
        expect(source, `${question.id} não existe na extração`).toBeDefined();
        expect(source.status).toBe('valid');
        expect(['A', 'B', 'C', 'D', 'E']).toContain(source.correct_option);
      }
    }
  });
});
