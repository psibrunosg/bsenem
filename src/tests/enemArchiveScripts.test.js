import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateInventoryEntry, validateInventory } from '../../scripts/enem/archiveContract.mjs';
import { discoverOfficialInventory, extractOfficialEntries } from '../../scripts/enem/discover-official-enem.mjs';
import { downloadEntry, downloadInventory, entriesForCanonicalSelection } from '../../scripts/enem/download-official-enem.mjs';
import { selectCanonicalEntries } from '../../scripts/enem/select-canonical-enem.mjs';

const validEntry = () => ({
  year: 2009,
  application: 'regular',
  documentKind: 'prova',
  officialUrl: 'https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno1_azul.pdf',
  sourcePageUrl: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos',
  discoveredAt: '2026-09-15T11:00:00.000Z'
});

describe('ENEM archive contract', () => {
  it('accepts an official ENEM inventory entry', () => {
    expect(validateInventoryEntry(validEntry())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['outside archive years', { year: 2008 }],
    ['unsafe protocol', { officialUrl: 'http://download.inep.gov.br/prova.pdf' }],
    ['non-Inep host', { officialUrl: 'https://example.com/prova.pdf' }],
    ['invalid document kind', { documentKind: 'edital' }],
    ['empty application', { application: '' }]
  ])('rejects %s', (_name, patch) => {
    expect(validateInventoryEntry({ ...validEntry(), ...patch })).toMatchObject({ valid: false });
  });

  it('rejects duplicate official documents without rejecting distinct source records', () => {
    const original = validEntry();
    const duplicate = { ...validEntry(), application: 'reaplicacao' };
    const distinct = { ...validEntry(), documentKind: 'gabarito', officialUrl: 'https://download.inep.gov.br/educacao_basica/enem/gabaritos/2009/gabarito_dia1.pdf' };

    expect(validateInventory([original, duplicate, distinct])).toEqual({
      valid: false,
      errors: ['entries[1].officialUrl']
    });
  });
});

describe('official ENEM index extraction', () => {
  const sourcePageUrl = 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos';
  const fixture = `
    <section><h2>2009</h2>
      <a href="https://download.inep.gov.br/educacao_basica/enem/provas/2009/dia1_caderno1_azul.pdf">Prova regular - caderno azul</a>
      <a href="https://download.inep.gov.br/educacao_basica/enem/gabaritos/2009/gabarito_dia1.pdf">Gabarito regular</a>
    </section>
    <section><h2>2020</h2>
      <a href="https://download.inep.gov.br/enem/2020/digital/prova.pdf">Enem Digital - prova</a>
      <a href="https://download.inep.gov.br/enem/2020/digital/gabarito.pdf">Enem Digital - gabarito</a>
    </section>`;

  it('extracts official links by year, application and document kind', () => {
    expect(extractOfficialEntries(fixture, sourcePageUrl, '2026-09-15T11:00:00.000Z')).toMatchObject({
      entries: [
        { year: 2009, application: 'regular', documentKind: 'prova' },
        { year: 2009, application: 'regular', documentKind: 'gabarito' },
        { year: 2020, application: 'digital', documentKind: 'prova' },
        { year: 2020, application: 'digital', documentKind: 'gabarito' }
      ],
      unclassifiedLinks: []
    });
  });

  it('retains unclassified and duplicate official links for human review', () => {
    const html = `<h2>2025</h2>
      <a href="https://download.inep.gov.br/enem/2025/prova.pdf">Material complementar</a>
      <a href="https://download.inep.gov.br/enem/2025/prova.pdf">Prova regular</a>`;

    expect(extractOfficialEntries(html, sourcePageUrl, '2026-09-15T11:00:00.000Z')).toMatchObject({
      entries: [{ year: 2025, documentKind: 'prova' }],
      unclassifiedLinks: [{ year: 2025, label: 'Material complementar' }]
    });
  });

  it('uses year from official tab endpoint when endpoint omits heading', () => {
    const html = '<a href="https://download.inep.gov.br/enem/2009/prova.pdf">Caderno de prova</a>';

    expect(extractOfficialEntries(html, `${sourcePageUrl}/2009`, '2026-09-15T11:00:00.000Z', 2009)).toMatchObject({
      entries: [{ year: 2009, application: 'regular', documentKind: 'prova' }],
      unclassifiedLinks: []
    });
  });

  it('fetches each official year tab instead of expecting links in index shell', async () => {
    const tabUrl = `${sourcePageUrl}/2009`;
    const responses = new Map([
      [sourcePageUrl, `<div class="tab-content" data-id="2009" data-url="${tabUrl}"></div>`],
      [tabUrl, '<a href="https://download.inep.gov.br/enem/2009/prova.pdf">Caderno de prova</a><a href="https://download.inep.gov.br/enem/2009/gabarito.pdf">Gabarito</a>']
    ]);
    const fetchImpl = async url => ({ ok: true, status: 200, text: async () => responses.get(url) });

    await expect(discoverOfficialInventory({ sourcePageUrl, years: [2009], fetchImpl, discoveredAt: '2026-09-15T11:00:00.000Z' })).resolves.toMatchObject({
      entries: [{ year: 2009, documentKind: 'prova' }, { year: 2009, documentKind: 'gabarito' }],
      unclassifiedLinks: []
    });
  });

  it('ignores official-host navigation links outside annual content', () => {
    const html = `
      <a href="https://download.inep.gov.br/other/caderno.pdf">Caderno de outro exame</a>
      <div id="parent-fieldname-text"><a href="https://download.inep.gov.br/enem/2009/prova.pdf">Prova</a></div>`;

    expect(extractOfficialEntries(html, `${sourcePageUrl}/2009`, '2026-09-15T11:00:00.000Z', 2009).entries).toEqual([
      expect.objectContaining({ officialUrl: 'https://download.inep.gov.br/enem/2009/prova.pdf' })
    ]);
  });

  it('keeps links after nested annual-content containers', () => {
    const html = `<div id="parent-fieldname-text"><h3>Aplicação regular</h3><div><p>Caderno azul</p></div>
      <a href="https://download.inep.gov.br/enem/2022/prova.pdf">Prova</a></div>`;

    expect(extractOfficialEntries(html, `${sourcePageUrl}/2022`, '2026-09-15T11:00:00.000Z', 2022).entries).toEqual([
      expect.objectContaining({ year: 2022, documentKind: 'prova' })
    ]);
  });

  it('keeps official caderno label and day with each discovered document', () => {
    const html = `<div id="parent-fieldname-text"><p class="callout">1º Dia - Caderno 1 - Azul - Aplicação Regular</p>
      <a href="https://download.inep.gov.br/enem/2022/prova.pdf">Prova</a>
      <a href="https://download.inep.gov.br/enem/2022/gabarito.pdf">Gabarito</a></div>`;

    expect(extractOfficialEntries(html, `${sourcePageUrl}/2022`, '2026-09-15T11:00:00.000Z', 2022).entries).toEqual([
      expect.objectContaining({ day: 1, sourceLabel: '1º Dia - Caderno 1 - Azul - Aplicação Regular', documentKind: 'prova' }),
      expect.objectContaining({ day: 1, sourceLabel: '1º Dia - Caderno 1 - Azul - Aplicação Regular', documentKind: 'gabarito' })
    ]);
  });

  it('recognizes non-ordinal official day labels', () => {
    const html = '<div id="parent-fieldname-text"><p>Dia 2 - Caderno 5 - Amarelo</p><a href="https://download.inep.gov.br/enem/2010/prova.pdf">Prova</a></div>';

    expect(extractOfficialEntries(html, `${sourcePageUrl}/2010`, '2026-09-15T11:00:00.000Z', 2010).entries).toEqual([
      expect.objectContaining({ day: 2 })
    ]);
  });

  it('records non-PDF and non-booklet material as excluded instead of downloadable proof', () => {
    const html = `<div id="parent-fieldname-text">
      <a href="https://download.inep.gov.br/enem/2025/caderno_dosvox.txt">Caderno de questões DOSVOX</a>
      <a href="https://download.inep.gov.br/enem/2025/tema_redacao.pdf">Tema da Redação</a>
    </div>`;
    const result = extractOfficialEntries(html, `${sourcePageUrl}/2025`, '2026-09-15T11:00:00.000Z', 2025);

    expect(result.entries).toEqual([]);
    expect(result.excludedLinks).toEqual([
      expect.objectContaining({ reason: 'unsupported-format', label: 'Caderno de questões DOSVOX' }),
      expect.objectContaining({ reason: 'outside-caderno-gabarito-scope', label: 'Tema da Redação' })
    ]);
  });

  it('runs command-line validation instead of silently exiting on Windows paths', () => {
    const result = spawnSync(process.execPath, ['scripts/enem/discover-official-enem.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing --output');
  });
});

describe('official ENEM downloader', () => {
  it('writes verified PDF bytes atomically under project archive structure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bsenem-enem-'));
    const bytes = Buffer.from('%PDF-1.7\nproof');
    const fetchImpl = async () => new Response(bytes, { status: 200, headers: { 'content-type': 'application/pdf' } });

    try {
      const record = await downloadEntry(validEntry(), root, fetchImpl, '2026-09-15T12:00:00.000Z');

      expect(record).toMatchObject({ status: 'downloaded', bytes: bytes.length, relativePath: expect.stringMatching(/^2009\/regular\//) });
      await expect(readFile(join(root, record.relativePath))).resolves.toEqual(bytes);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects unsafe URLs and non-PDF responses before persisting a file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bsenem-enem-'));
    try {
      await expect(downloadEntry({ ...validEntry(), officialUrl: 'https://example.com/prova.pdf' }, root, fetch)).rejects.toThrow('unsafe download URL');
      await expect(downloadEntry(validEntry(), root, async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }))).rejects.toThrow('invalid PDF response');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts an explicit Projeto Medicina mirror while retaining the official source URL', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bsenem-enem-'));
    const mirrorUrl = 'https://cdn.projetomedicina.com.br/provas-enem/2009/prova-dia1.pdf';
    let requestedUrl;
    try {
      const record = await downloadEntry({
        ...validEntry(),
        sourceType: 'nonofficial-mirror',
        mirrorProvider: 'Projeto Medicina',
        mirrorUrl
      }, root, async url => {
        requestedUrl = url;
        return new Response(Buffer.from('%PDF-1.7\nmirror'), { status: 200, headers: { 'content-type': 'application/pdf' } });
      });

      expect(requestedUrl).toBe(mirrorUrl);
      expect(record).toMatchObject({ officialUrl: validEntry().officialUrl, mirrorUrl, sourceType: 'nonofficial-mirror' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('records each inventory failure without discarding verified downloads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bsenem-enem-'));
    const good = validEntry();
    const bad = { ...validEntry(), officialUrl: 'https://download.inep.gov.br/enem/2009/bad.pdf' };
    const fetchImpl = async url => url === good.officialUrl
      ? new Response('%PDF-1.7\nproof', { status: 200, headers: { 'content-type': 'application/pdf' } })
      : new Response('missing', { status: 404, headers: { 'content-type': 'text/html' } });

    try {
      await expect(downloadInventory([good, bad], root, fetchImpl, '2026-09-15T12:00:00.000Z')).resolves.toMatchObject({
        entries: [{ status: 'downloaded' }, { status: 'failed', failureReason: 'invalid PDF response' }]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts exactly the 34 selected cadernos and matching 34 gabaritos', () => {
    const selections = Array.from({ length: 34 }, (_, index) => ({
      year: 2009,
      day: 1,
      prova: { ...validEntry(), officialUrl: `https://download.inep.gov.br/enem/${index}-prova.pdf` },
      gabarito: { ...validEntry(), documentKind: 'gabarito', officialUrl: `https://download.inep.gov.br/enem/${index}-gabarito.pdf` }
    }));

    expect(entriesForCanonicalSelection({ cadernoCount: 34, gabaritoCount: 34, selections })).toHaveLength(68);
    expect(entriesForCanonicalSelection({ cadernoCount: 34, gabaritoCount: 34, selections }, 'projeto-medicina')[0]).toMatchObject({
      sourceType: 'nonofficial-mirror',
      mirrorProvider: 'Projeto Medicina',
      mirrorUrl: 'https://cdn.projetomedicina.com.br/provas-enem/2009/prova-dia1.pdf'
    });
    expect(() => entriesForCanonicalSelection({ cadernoCount: 35, gabaritoCount: 35, selections: [...selections, selections[0]] })).toThrow('expected exactly 34 canonical selections');
  });
});

describe('canonical ENEM caderno selection', () => {
  const entry = (year, day, documentKind, sourceLabel, application = 'regular', officialUrl) => ({
    ...validEntry(),
    year,
    day,
    application,
    documentKind,
    sourceLabel,
    officialUrl: officialUrl || `https://download.inep.gov.br/enem/${year}/${encodeURIComponent(sourceLabel)}-${documentKind}.pdf`
  });

  it('selects one preferred regular caderno and matching answer key per day', () => {
    const inventory = { entries: [
      entry(2009, 1, 'prova', '1º Dia - Caderno 1 - Azul'),
      entry(2009, 1, 'gabarito', '1º Dia - Caderno 1 - Azul'),
      entry(2009, 1, 'prova', '1º Dia - Caderno 2 - Amarelo'),
      entry(2009, 1, 'gabarito', '1º Dia - Caderno 2 - Amarelo'),
      entry(2009, 2, 'prova', '2º Dia - Caderno 5 - Amarelo'),
      entry(2009, 2, 'gabarito', '2º Dia - Caderno 5 - Amarelo'),
      entry(2009, 2, 'prova', '2º Dia - Caderno 7 - Azul'),
      entry(2009, 2, 'gabarito', '2º Dia - Caderno 7 - Azul'),
      entry(2009, 1, 'prova', '1º Dia - Caderno 9 - Laranja (braile e ledor)'),
      entry(2009, 1, 'gabarito', '1º Dia - Caderno 9 - Laranja (braile e ledor)'),
      entry(2009, 1, 'prova', '1º Dia - Caderno 1 - Azul - PPL', 'ppl')
    ] };

    expect(selectCanonicalEntries(inventory)).toEqual([
      expect.objectContaining({ year: 2009, day: 1, selectionReason: 'preferred-caderno', prova: expect.objectContaining({ sourceLabel: '1º Dia - Caderno 1 - Azul' }) }),
      expect.objectContaining({ year: 2009, day: 2, selectionReason: 'preferred-caderno', prova: expect.objectContaining({ sourceLabel: '2º Dia - Caderno 5 - Amarelo' }) })
    ]);
  });

  it('uses explicit-day fallback and fails closed when matching answer key is absent', () => {
    const fallback = [
      entry(2010, 1, 'prova', 'Dia 1 - Caderno 4 - Rosa'),
      entry(2010, 1, 'gabarito', 'Dia 1 - Caderno 4 - Rosa'),
      entry(2010, 2, 'prova', 'Dia 2 - Caderno 7 - Azul'),
      entry(2010, 2, 'gabarito', 'Dia 2 - Caderno 7 - Azul')
    ];

    expect(selectCanonicalEntries({ entries: fallback })).toEqual([
      expect.objectContaining({ day: 1, selectionReason: 'fallback-first-standard-caderno' }),
      expect.objectContaining({ day: 2, selectionReason: 'fallback-first-standard-caderno' })
    ]);
    expect(() => selectCanonicalEntries({ entries: fallback.filter(item => item.documentKind !== 'gabarito') })).toThrow('missing matching gabarito');
  });

  it('uses the official day token rather than the caderno code when a reapplication shares its label', () => {
    const blue = '1º Dia - Caderno 1 - Azul';
    const yellow = '2º Dia - Caderno 5 - Amarelo';
    const inventory = { entries: [
      entry(2025, 1, 'prova', blue, 'regular', 'https://download.inep.gov.br/enem/2025_PV_impresso_D1_CD1.pdf'),
      entry(2025, 1, 'gabarito', blue, 'regular', 'https://download.inep.gov.br/enem/2025_GB_impresso_D1_CD1.pdf'),
      entry(2025, 1, 'prova', blue, 'regular', 'https://download.inep.gov.br/enem/2025_PV_impresso_D3_CD1.pdf'),
      entry(2025, 1, 'gabarito', blue, 'regular', 'https://download.inep.gov.br/enem/2025_GB_impresso_D3_CD1.pdf'),
      entry(2025, 2, 'prova', yellow, 'regular', 'https://download.inep.gov.br/enem/2025_PV_impresso_D2_CD5.pdf'),
      entry(2025, 2, 'gabarito', yellow, 'regular', 'https://download.inep.gov.br/enem/2025_GB_impresso_D2_CD5.pdf')
    ] };

    const selected = selectCanonicalEntries(inventory);
    expect(selected[0].prova.officialUrl).toContain('_D1_CD1.pdf');
    expect(selected[0].gabarito.officialUrl).toContain('_D1_CD1.pdf');
  });
});
