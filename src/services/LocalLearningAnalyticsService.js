import { idb as browserIdb } from '../utils/idb.js';

const SCHEMA_VERSION = 1;
const STORAGE_MESSAGE = 'O progresso local não pôde ser salvo neste navegador. Libere espaço ou permita o armazenamento do site.';
const storageLocks = new Map();

export class LocalLearningAnalyticsService {
  constructor({ idb = browserIdb, userId, libraryId, libraryFingerprint = null, clock = () => new Date() } = {}) {
    if (!String(userId || '').trim()) throw new Error('Authenticated user is required for local analytics.');
    if (!String(libraryId || '').trim()) throw new Error('Library identity is required for local analytics.');
    this.idb = idb;
    this.clock = clock;
    this.libraryFingerprint = normalizedFingerprint(libraryFingerprint);
    this.scopeKey = `local-learning:${userId}:${libraryId}`;
    this.key = `${this.scopeKey}:fingerprint:${encodeURIComponent(this.libraryFingerprint || 'unversioned')}`;
    this.activeFingerprintKey = `${this.scopeKey}:active-fingerprint`;
    this.memoryState = emptyState(this.libraryFingerprint);
    this.memoryInitialized = false;
    this.storageAvailable = true;
    this.stateStatus = readyStatus();
  }

  recordRange(record) {
    return withStorageLock(this.scopeKey, () => this.recordRangeNow(record));
  }

  async recordRangeNow(record) {
    const normalized = normalizeRecord(record, this.clock);
    const state = await this.readState();
    if (!normalized) return summarize(state, this.clock(), this.stateStatus);

    const previous = state.lessons[normalized.lessonId];
    const intervals = mergeIntervals([...(previous?.intervals || []), normalized.interval]);
    const activity = [...(previous?.activity || []), {
      fromSeconds: normalized.interval[0],
      toSeconds: normalized.interval[1],
      recordedAt: normalized.recordedAt
    }];
    state.lessons[normalized.lessonId] = {
      courseTitle: normalized.courseTitle,
      moduleTitle: normalized.moduleTitle,
      durationSeconds: normalized.durationSeconds,
      intervals,
      lastInteractionAt: normalized.recordedAt,
      activity
    };
    this.memoryState = state;
    this.memoryInitialized = true;
    await this.persist(state);
    return summarize(state, this.clock(), this.stateStatus);
  }

  async getSummary(now = this.clock()) {
    return withStorageLock(this.scopeKey, async () => summarize(await this.readState(), now, this.stateStatus));
  }

  async readState() {
    if (!this.storageAvailable) return this.memoryState;
    try {
      const stored = await this.idb.get(this.key);
      if (stored === undefined) {
        const activeFingerprint = await this.idb.get(this.activeFingerprintKey);
        this.memoryState = emptyState(this.libraryFingerprint);
        this.memoryInitialized = true;
        this.stateStatus = activeFingerprint !== undefined && activeFingerprint !== this.libraryFingerprint
          ? staleLibraryStatus()
          : readyStatus();
        return this.memoryState;
      }
      if (!validState(stored)) {
        this.memoryState = emptyState(this.libraryFingerprint);
        this.memoryInitialized = true;
        if (stored !== undefined) this.stateStatus = staleSchemaStatus();
        return this.memoryState;
      }
      if (stored.libraryFingerprint !== this.libraryFingerprint) {
        this.memoryState = emptyState(this.libraryFingerprint);
        this.memoryInitialized = true;
        this.stateStatus = staleLibraryStatus();
        return this.memoryState;
      }
      this.memoryState = clone(stored);
      this.memoryInitialized = true;
      this.stateStatus = readyStatus();
      return this.memoryState;
    } catch (error) {
      this.useMemoryFallback(error);
      return this.memoryState;
    }
  }

  async persist(state) {
    if (!this.storageAvailable) return;
    try {
      await this.idb.set(this.key, state);
      await this.idb.set(this.activeFingerprintKey, this.libraryFingerprint);
      this.stateStatus = readyStatus();
    } catch (error) {
      this.useMemoryFallback(error);
    }
  }

  useMemoryFallback() {
    this.storageAvailable = false;
    if (!this.memoryInitialized) {
      this.memoryState = emptyState(this.libraryFingerprint);
      this.memoryInitialized = true;
    }
    this.stateStatus = storageUnavailableStatus();
  }
}

function normalizeRecord(record, clock) {
  const lessonId = String(record?.lessonId || '').trim();
  const courseTitle = cleanLabel(record?.courseTitle, 'Curso local');
  const moduleTitle = cleanLabel(record?.moduleTitle, 'Módulo local');
  const from = Number(record?.fromSeconds);
  const to = Number(record?.toSeconds);
  const duration = Number(record?.durationSeconds);
  if (!lessonId || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(duration) || duration <= 0) return null;
  const start = Math.max(0, Math.round(from));
  const end = Math.min(Math.round(duration), Math.max(0, Math.round(to)));
  if (end <= start) return null;
  const recordedAt = validTimestamp(record?.recordedAt) || validTimestamp(clock()) || new Date().toISOString();
  return {
    lessonId,
    courseTitle,
    moduleTitle,
    durationSeconds: Math.round(duration),
    interval: [start, end],
    recordedAt
  };
}

function summarize(state, now, status) {
  const lessons = Object.entries(state.lessons || {});
  const performance = new Map();
  const recent = [];
  let totalSeconds = 0;
  let todaySeconds = 0;
  const dayKey = localDayKey(now);

  for (const [lessonId, lesson] of lessons) {
    const watchedSeconds = intervalSeconds(lesson.intervals);
    if (watchedSeconds <= 0) continue;
    totalSeconds += watchedSeconds;
    const todayIntervals = (lesson.activity || [])
      .filter((entry) => localDayKey(entry.recordedAt) === dayKey)
      .map((entry) => [entry.fromSeconds, entry.toSeconds]);
    todaySeconds += intervalSeconds(mergeIntervals(todayIntervals));
    const completed = Number.isFinite(lesson.durationSeconds)
      && lesson.durationSeconds > 0
      && watchedSeconds >= lesson.durationSeconds;
    addPerformance(performance, `course:${lesson.courseTitle}`, lesson.courseTitle, 'course', watchedSeconds, completed);
    addPerformance(performance, `module:${lesson.courseTitle}\u0000${lesson.moduleTitle}`, lesson.moduleTitle, 'module', watchedSeconds, completed);
    recent.push({
      id: lessonId,
      lessonId,
      courseTitle: lesson.courseTitle,
      moduleTitle: lesson.moduleTitle,
      watchedSeconds,
      completed,
      recordedAt: lesson.lastInteractionAt
    });
  }

  return {
    totalMinutes: minutes(totalSeconds),
    todayMinutes: minutes(todaySeconds),
    performance: [...performance.values()].map((row) => ({
      ...row,
      studyMinutes: minutes(row.studySeconds)
    })).map(({ studySeconds: _studySeconds, ...row }) => row),
    recent: recent.sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt))),
    status: { ...status }
  };
}

function addPerformance(rows, id, label, kind, seconds, completed) {
  const row = rows.get(id) || { id, label, kind, studySeconds: 0, lessonsCompleted: 0 };
  row.studySeconds += seconds;
  if (completed) row.lessonsCompleted += 1;
  rows.set(id, row);
}

export function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((interval) => Array.isArray(interval) && interval.length === 2)
    .map(([from, to]) => [Number(from), Number(to)])
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1]) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

function intervalSeconds(intervals = []) {
  return intervals.reduce((sum, [from, to]) => sum + Math.max(0, to - from), 0);
}

function minutes(seconds) {
  return Math.round(seconds / 0.6) / 100;
}

function cleanLabel(value, fallback) {
  const label = String(value || '').trim();
  return label || fallback;
}

function validTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function localDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizedFingerprint(value) {
  const fingerprint = String(value || '').trim();
  return fingerprint || null;
}

function emptyState(libraryFingerprint) {
  return { schemaVersion: SCHEMA_VERSION, libraryFingerprint, lessons: {} };
}

function validState(state) {
  return state !== null
    && typeof state === 'object'
    && state.schemaVersion === SCHEMA_VERSION
    && (state.libraryFingerprint === null || typeof state.libraryFingerprint === 'string')
    && state.lessons !== null
    && typeof state.lessons === 'object'
    && !Array.isArray(state.lessons)
    && Object.entries(state.lessons).every(([lessonId, lesson]) => validLesson(lessonId, lesson));
}

function validLesson(lessonId, lesson) {
  return Boolean(String(lessonId).trim())
    && lesson !== null
    && typeof lesson === 'object'
    && typeof lesson.courseTitle === 'string'
    && typeof lesson.moduleTitle === 'string'
    && Number.isFinite(lesson.durationSeconds)
    && lesson.durationSeconds > 0
    && Array.isArray(lesson.intervals)
    && lesson.intervals.every((interval) => validInterval(interval, lesson.durationSeconds))
    && Array.isArray(lesson.activity)
    && lesson.activity.every((entry) => entry !== null
      && typeof entry === 'object'
      && validInterval([entry.fromSeconds, entry.toSeconds], lesson.durationSeconds)
      && validTimestamp(entry.recordedAt) !== null)
    && validTimestamp(lesson.lastInteractionAt) !== null;
}

function validInterval(interval, duration) {
  return Array.isArray(interval)
    && interval.length === 2
    && Number.isFinite(interval[0])
    && Number.isFinite(interval[1])
    && interval[0] >= 0
    && interval[1] > interval[0]
    && interval[1] <= duration;
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function readyStatus() {
  return { code: 'ready', persistent: true, message: '' };
}

function staleLibraryStatus() {
  return {
    code: 'stale-library',
    persistent: true,
    message: 'A biblioteca mudou desde o último registro. Reproduza uma aula para iniciar novas análises locais.'
  };
}

function staleSchemaStatus() {
  return {
    code: 'stale-schema',
    persistent: true,
    message: 'Os dados locais antigos não são compatíveis e não foram usados.'
  };
}

function storageUnavailableStatus() {
  return { code: 'storage-unavailable', persistent: false, message: STORAGE_MESSAGE };
}

function withStorageLock(scopeKey, operation) {
  const lockName = `bsenem:${scopeKey}`;
  if (globalThis.navigator?.locks?.request) return globalThis.navigator.locks.request(lockName, operation);
  const previous = storageLocks.get(scopeKey) || Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const tail = current.catch(() => undefined);
  storageLocks.set(scopeKey, tail);
  return current.finally(() => {
    if (storageLocks.get(scopeKey) === tail) storageLocks.delete(scopeKey);
  });
}
