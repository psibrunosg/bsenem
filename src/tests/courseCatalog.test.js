import { describe, expect, it } from 'vitest';
import { buildCourseCatalog, displayTitle } from '../services/courseCatalog.js';

const item = (id, pathSegments, rawTitle, resourceType) => ({
  id,
  pathSegments,
  rawTitle,
  title: rawTitle,
  resourceType,
  relativePath: [...pathSegments, `${rawTitle}.${resourceType}`].join('/')
});

describe('courseCatalog', () => {
  it('collapses typed directories and pairs same-stem media in one module', () => {
    const catalog = buildCourseCatalog([
      item('v1', ['INPBE', '01 - Fundamentos', 'Vídeos'], '01-Introdução', 'video'),
      item('a1', ['INPBE', '01 - Fundamentos', 'Áudios'], '01-Introdução', 'audio'),
      item('p1', ['INPBE', '01 - Fundamentos', 'PDFs'], 'C4-A3-MC4 - Leitura', 'pdf')
    ]);

    expect(catalog.courses[0].title).toBe('INPBE');
    expect(catalog.courses[0].modules[0].title).toBe('Fundamentos');
    expect(catalog.courses[0].modules[0].lessons[0]).toMatchObject({
      title: 'Introdução', video: { id: 'v1' }, audio: { id: 'a1' }
    });
    expect(catalog.courses[0].modules[0].materials[0].title).toBe('Leitura');
  });

  it('does not expose a code-only stem and does not pair across modules', () => {
    expect(displayTitle('C4-A3-MC4')).toBe('Material complementar');
    const catalog = buildCourseCatalog([
      item('video-one', ['Curso', 'Módulo um', 'Vídeos'], 'Aula comum', 'video'),
      item('audio-two', ['Curso', 'Módulo dois', 'Áudios'], 'Aula comum', 'audio')
    ]);

    expect(catalog.lessons.size).toBe(2);
  });

  it('does not pair media whose raw stems differ only by case', () => {
    const catalog = buildCourseCatalog([
      item('video-one', ['Curso', 'Módulo', 'Vídeos'], 'Aula', 'video'),
      item('audio-two', ['Curso', 'Módulo', 'Áudios'], 'aula', 'audio')
    ]);

    expect(catalog.lessons.size).toBe(2);
    expect(catalog.courses[0].modules[0].lessons).toEqual(expect.arrayContaining([
      expect.objectContaining({ video: expect.objectContaining({ id: 'video-one' }), audio: null }),
      expect.objectContaining({ video: null, audio: expect.objectContaining({ id: 'audio-two' }) })
    ]));
  });
});
