import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalLearningAnalyticsService } from '../services/LocalLearningAnalyticsService.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { api } from '../utils/api.js';

const day = new Date('2026-09-01T18:00:00-03:00');

function memoryStore() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key); },
    async set(key, value) { values.set(key, structuredClone(value)); },
    async delete(key) { values.delete(key); }
  };
}

function range(lessonId, fromSeconds, toSeconds, overrides = {}) {
  return {
    lessonId,
    courseTitle: 'Biologia',
    moduleTitle: 'Neurociência',
    fromSeconds,
    toSeconds,
    durationSeconds: 120,
    recordedAt: '2026-09-01T15:00:00.000Z',
    ...overrides
  };
}

function serviceFor(idb, userId = 'u1', libraryId = 'library-a', overrides = {}) {
  return new LocalLearningAnalyticsService({ idb, userId, libraryId, clock: () => day, ...overrides });
}

describe('LocalLearningAnalyticsService', () => {
  it('merges overlapping and adjacent watched ranges instead of double-counting seek or replay', async () => {
    const service = serviceFor(memoryStore());
    await service.recordRange(range('lesson-a', 0, 80));
    await service.recordRange(range('lesson-a', 40, 100));
    await service.recordRange(range('lesson-a', 100, 120));

    const summary = await service.getSummary(day);

    expect(summary.totalMinutes).toBe(2);
    expect(summary.performance).toEqual([
      { id: 'course:Biologia', label: 'Biologia', kind: 'course', studyMinutes: 2, lessonsCompleted: 1 },
      { id: 'module:Biologia\u0000Neurociência', label: 'Neurociência', kind: 'module', studyMinutes: 2, lessonsCompleted: 1 }
    ]);
  });

  it('does not read another profile or library key', async () => {
    const idb = memoryStore();
    await serviceFor(idb, 'u1', 'library-a').recordRange(range('lesson-a', 0, 60));

    expect((await serviceFor(idb, 'u2', 'library-a').getSummary(day)).totalMinutes).toBe(0);
    expect((await serviceFor(idb, 'u1', 'library-b').getSummary(day)).totalMinutes).toBe(0);
    expect([...idb.values.keys()]).toContain('local-learning:u1:library-a:fingerprint:unversioned');
  });

  it('serializes concurrent checkpoints from distinct service instances so one write cannot erase another', async () => {
    const idb = memoryStore();
    const first = serviceFor(idb);
    const second = serviceFor(idb);

    await Promise.all([
      first.recordRange(range('lesson-a', 0, 60)),
      second.recordRange(range('lesson-b', 0, 60, { moduleTitle: 'Genética' }))
    ]);

    expect((await first.getSummary(day)).totalMinutes).toBe(2);
  });

  it('stores a schema version and only opaque lesson facts, labels, durations, ranges, and timestamps', async () => {
    const idb = memoryStore();
    const service = serviceFor(idb);
    await service.recordRange(range('lesson-a', 0.2, 15.7));

    expect(idb.values.get(service.key)).toEqual({
      schemaVersion: 1,
      libraryFingerprint: null,
      lessons: {
        'lesson-a': {
          courseTitle: 'Biologia',
          moduleTitle: 'Neurociência',
          durationSeconds: 120,
          intervals: [[0, 16]],
          lastInteractionAt: '2026-09-01T15:00:00.000Z',
          activity: [{ fromSeconds: 0, toSeconds: 16, recordedAt: '2026-09-01T15:00:00.000Z' }]
        }
      }
    });
  });

  it('invalidates analytics produced by a stale library scan fingerprint', async () => {
    const idb = memoryStore();
    await serviceFor(idb, 'u1', 'library-a', { libraryFingerprint: 'scan-a' })
      .recordRange(range('lesson-a', 0, 60));

    const staleSummary = await serviceFor(idb, 'u1', 'library-a', { libraryFingerprint: 'scan-b' }).getSummary(day);

    expect(staleSummary.totalMinutes).toBe(0);
    expect(staleSummary.recent).toEqual([]);
    expect(staleSummary.status.code).toBe('stale-library');
    expect([...idb.values.keys()]).toContain('local-learning:u1:library-a:fingerprint:scan-a');
  });

  it('treats malformed nested lesson and interval data as a stale schema instead of throwing', async () => {
    const idb = memoryStore();
    const service = serviceFor(idb);
    idb.values.set(service.key, {
      schemaVersion: 1,
      libraryFingerprint: null,
      lessons: {
        broken: {
          courseTitle: 'Biologia',
          moduleTitle: 'Genética',
          durationSeconds: 120,
          intervals: [['not-a-number', 30]],
          activity: [{ fromSeconds: 0, toSeconds: 20, recordedAt: 'invalid-date' }],
          lastInteractionAt: 'invalid-date'
        }
      }
    });

    const summary = await service.getSummary(day);

    expect(summary.totalMinutes).toBe(0);
    expect(summary.status.code).toBe('stale-schema');
  });

  it('caps ranges at finite media duration and derives today and recent activity from real records', async () => {
    const service = serviceFor(memoryStore());
    await service.recordRange(range('lesson-a', 90, 180, {
      durationSeconds: 120,
      recordedAt: '2026-08-31T15:00:00.000Z'
    }));
    await service.recordRange(range('lesson-b', 0, 60, {
      moduleTitle: 'Genética',
      durationSeconds: 300,
      recordedAt: '2026-09-01T16:00:00.000Z'
    }));

    const summary = await service.getSummary(day);

    expect(summary.totalMinutes).toBe(1.5);
    expect(summary.todayMinutes).toBe(1);
    expect(summary.recent).toEqual([
      {
        id: 'lesson-b',
        lessonId: 'lesson-b',
        courseTitle: 'Biologia',
        moduleTitle: 'Genética',
        watchedSeconds: 60,
        completed: false,
        recordedAt: '2026-09-01T16:00:00.000Z'
      },
      {
        id: 'lesson-a',
        lessonId: 'lesson-a',
        courseTitle: 'Biologia',
        moduleTitle: 'Neurociência',
        watchedSeconds: 30,
        completed: false,
        recordedAt: '2026-08-31T15:00:00.000Z'
      }
    ]);
  });

  it.each([
    ['quota', new DOMException('full', 'QuotaExceededError')],
    ['security', new DOMException('blocked', 'SecurityError')]
  ])('keeps the current-session facts in memory with an actionable status when %s storage is unavailable', async (_kind, storageError) => {
    const idb = {
      async get() { throw storageError; },
      async set() { throw storageError; }
    };
    const service = serviceFor(idb);

    const snapshot = await service.recordRange(range('lesson-a', 0, 60));
    const summary = await service.getSummary(day);

    expect(snapshot.totalMinutes).toBe(1);
    expect(summary.totalMinutes).toBe(1);
    expect(summary.status).toEqual({
      code: 'storage-unavailable',
      persistent: false,
      message: 'O progresso local não pôde ser salvo neste navegador. Libere espaço ou permita o armazenamento do site.'
    });
  });
});

describe('DashboardPage local analytics loading', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retains a valid local summary when account APIs fail and exposes its recorder to the player', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('offline'));
    const localSummary = { totalMinutes: 3, todayMinutes: 1, performance: [], recent: [], status: { code: 'ready', persistent: true, message: '' } };
    const service = { getSummary: vi.fn().mockResolvedValue(localSummary), recordRange: vi.fn() };
    const analyticsFactory = vi.fn(() => service);
    const library = {
      idb: memoryStore(),
      items: [{ id: 'video-1' }],
      catalog: { lessons: new Map([['lesson-1', { id: 'lesson-1', video: { id: 'video-1' }, audio: null }]]) },
      libraryId: vi.fn().mockResolvedValue('library-a')
    };
    await library.idb.set('local-library-handle', { kind: 'directory' });
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library, analyticsFactory });

    const result = await page.loadActivityData();

    expect(result.account.status).toBe('error');
    expect(result.local).toEqual({ status: 'ready', data: localSummary });
    await library.learningAnalytics.recordRange(range('lesson-a', 0, 15));
    expect(service.recordRange).toHaveBeenCalledOnce();
    expect(analyticsFactory).toHaveBeenCalledWith(expect.objectContaining({
      idb: library.idb,
      userId: 'u1',
      libraryId: 'library-a',
      libraryFingerprint: expect.stringMatching(/^catalog-v1:/)
    }));
  });

  it('returns a distinct actionable local-unavailable summary when no folder is connected', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ success: true, data: { '2026-09-01': 20 } })
      .mockResolvedValueOnce({ success: true, data: { total_study_minutes: 20 } });
    const idb = memoryStore();
    const analyticsFactory = vi.fn();
    const library = { idb, items: [], catalog: { lessons: new Map() }, libraryId: vi.fn().mockResolvedValue('library-a') };
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library, analyticsFactory });

    const result = await page.loadActivityData();

    expect(result.account.status).toBe('ready');
    expect(result.local.status).toBe('unavailable');
    expect(result.local.data.status).toEqual({
      code: 'library-unavailable',
      persistent: false,
      message: 'Dados da biblioteca estarão disponíveis após conectar uma pasta.'
    });
    expect(analyticsFactory).not.toHaveBeenCalled();
  });

  it('keeps a deferred recorder ready for playback after a folder is connected later', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ success: true, data: {} })
      .mockResolvedValueOnce({ success: true, data: {} });
    const idb = memoryStore();
    const recordRange = vi.fn().mockResolvedValue({ status: { code: 'ready', persistent: true, message: '' } });
    const service = { getSummary: vi.fn().mockResolvedValue({ totalMinutes: 0, todayMinutes: 0, performance: [], recent: [], status: { code: 'ready', persistent: true, message: '' } }), recordRange };
    const analyticsFactory = vi.fn(() => service);
    const library = { idb, items: [], catalog: { lessons: new Map() }, libraryId: vi.fn().mockResolvedValue('library-a') };
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library, analyticsFactory });
    await page.loadActivityData();
    await idb.set('local-library-handle', { kind: 'directory' });
    const playback = range('lesson-a', 0, 15);

    await library.learningAnalytics.recordRange(playback);

    expect(analyticsFactory).toHaveBeenCalledOnce();
    expect(recordRange).toHaveBeenCalledWith(playback);
  });

  it('retains valid account data when local library identity loading fails', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ success: true, data: { '2026-09-01': 20 } })
      .mockResolvedValueOnce({ success: true, data: { total_study_minutes: 20 } });
    const idb = memoryStore();
    await idb.set('local-library-handle', { kind: 'directory' });
    const library = { idb, items: [], catalog: { lessons: new Map() }, libraryId: vi.fn().mockRejectedValue(new Error('blocked')) };
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library });

    const result = await page.loadActivityData();

    expect(result.account).toMatchObject({
      status: 'ready',
      data: { heatmap: { '2026-09-01': 20 }, dashboard: { total_study_minutes: 20 } }
    });
    expect(result.local.status).toBe('error');
  });

  it('settles heatmap and dashboard endpoints independently and retains the successful account source', async () => {
    vi.spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('heatmap offline'))
      .mockResolvedValueOnce({ success: true, data: { total_study_minutes: 42 } });
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library: null });

    const result = await page.loadActivityData();

    expect(result.account.status).toBe('partial');
    expect(result.account.sources).toEqual({ heatmap: 'error', dashboard: 'ready' });
    expect(result.account.data).toEqual({ heatmap: {}, dashboard: { total_study_minutes: 42 } });
    expect(page.dashboardData).toEqual({ total_study_minutes: 42 });
  });

  it('recreates local analytics when library identity or media metadata changes', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValue({ success: true, data: {} });
    const idb = memoryStore();
    await idb.set('local-library-handle', { kind: 'directory' });
    const video = { id: 'video-1', size: 10, modifiedAt: 100 };
    const lesson = { id: 'lesson-1', video, audio: null };
    const libraryId = vi.fn().mockResolvedValueOnce('library-a').mockResolvedValueOnce('library-a').mockResolvedValue('library-b');
    const library = { idb, items: [video], catalog: { lessons: new Map([['lesson-1', lesson]]) }, libraryId };
    const services = [
      { getSummary: vi.fn().mockResolvedValue({ status: { code: 'ready' } }), recordRange: vi.fn().mockResolvedValue({ status: { code: 'ready' } }) },
      { getSummary: vi.fn().mockResolvedValue({ status: { code: 'ready' } }), recordRange: vi.fn().mockResolvedValue({ status: { code: 'ready' } }) },
      { getSummary: vi.fn().mockResolvedValue({ status: { code: 'ready' } }), recordRange: vi.fn().mockResolvedValue({ status: { code: 'ready' } }) }
    ];
    const analyticsFactory = vi.fn(() => services.shift());
    const page = new DashboardPage({ user: { id: 'u1', name: 'Ana' }, library, analyticsFactory });
    await page.loadActivityData();
    const firstFingerprint = analyticsFactory.mock.calls[0][0].libraryFingerprint;
    video.modifiedAt = 200;

    await library.learningAnalytics.recordRange(range('lesson-a', 0, 15));
    const changedFingerprint = analyticsFactory.mock.calls[1][0].libraryFingerprint;
    await library.learningAnalytics.recordRange(range('lesson-a', 15, 30));

    expect(changedFingerprint).not.toBe(firstFingerprint);
    expect(analyticsFactory.mock.calls[2][0]).toMatchObject({ libraryId: 'library-b' });
  });
});
