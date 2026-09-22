import { describe, expect, it, vi } from 'vitest';
import { SimulatorApiService } from '../services/SimulatorApiService.js';

function ok(data) {
  return { success: true, data };
}

function fail(message) {
  return { success: false, message };
}

function createApi() {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
}

describe('SimulatorApiService', () => {
  it('fetches the catalog', async () => {
    const api = createApi();
    api.get.mockResolvedValueOnce(ok({ subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }] }));
    const service = new SimulatorApiService(api);

    const result = await service.catalog();

    expect(api.get).toHaveBeenCalledWith('/simulators/catalog');
    expect(result).toEqual({ subjects: [{ key: 'Matemática', label: 'Matemática', available: 10 }] });
  });

  it('fetches the overview', async () => {
    const api = createApi();
    api.get.mockResolvedValueOnce(ok({ recommendation: null, mastery: [], active_sessions: [] }));
    const service = new SimulatorApiService(api);

    const result = await service.overview();

    expect(api.get).toHaveBeenCalledWith('/simulators/overview');
    expect(result).toEqual({ recommendation: null, mastery: [], active_sessions: [] });
  });

  it('fetches active sessions', async () => {
    const api = createApi();
    api.get.mockResolvedValueOnce(ok({ sessions: [{ id: 'abc' }] }));
    const service = new SimulatorApiService(api);

    const result = await service.activeSessions();

    expect(api.get).toHaveBeenCalledWith('/simulators/sessions?status=active');
    expect(result).toEqual({ sessions: [{ id: 'abc' }] });
  });

  it('creates a session', async () => {
    const api = createApi();
    api.post.mockResolvedValueOnce(ok({ session: { id: 'abc', kind: 'practice' } }));
    const service = new SimulatorApiService(api);

    const result = await service.createSession({ kind: 'practice', subjects: ['Matemática'], count: 10 });

    expect(api.post).toHaveBeenCalledWith('/simulators/sessions', { kind: 'practice', subjects: ['Matemática'], count: 10 });
    expect(result).toEqual({ session: { id: 'abc', kind: 'practice' } });
  });

  it('fetches a single session', async () => {
    const api = createApi();
    api.get.mockResolvedValueOnce(ok({ session: { id: 'abc' } }));
    const service = new SimulatorApiService(api);

    const result = await service.session('abc');

    expect(api.get).toHaveBeenCalledWith('/simulators/sessions/abc');
    expect(result).toEqual({ session: { id: 'abc' } });
  });

  it('saves progress with PATCH', async () => {
    const api = createApi();
    api.patch.mockResolvedValueOnce(ok({ session: { id: 'abc', current_position: 1 } }));
    const service = new SimulatorApiService(api);

    const result = await service.saveProgress('abc', { position: 1, elapsed_seconds: 10, answers: [] });

    expect(api.patch).toHaveBeenCalledWith('/simulators/sessions/abc/progress', { position: 1, elapsed_seconds: 10, answers: [] });
    expect(result).toEqual({ session: { id: 'abc', current_position: 1 } });
  });

  it('completes a session', async () => {
    const api = createApi();
    api.post.mockResolvedValueOnce(ok({ session: { id: 'abc', status: 'completed' }, result: { correct: 1 } }));
    const service = new SimulatorApiService(api);

    const result = await service.complete('abc');

    expect(api.post).toHaveBeenCalledWith('/simulators/sessions/abc/complete');
    expect(result).toEqual({ session: { id: 'abc', status: 'completed' }, result: { correct: 1 } });
  });

  it('throws the server message when a request fails', async () => {
    const api = createApi();
    api.post.mockResolvedValueOnce(fail('Não há questões publicadas suficientes para esta seleção.'));
    const service = new SimulatorApiService(api);

    await expect(service.createSession({ kind: 'practice', subjects: ['Matemática'], count: 90 }))
      .rejects.toThrow('Não há questões publicadas suficientes para esta seleção.');
  });

  it('falls back to a generic message when the server omits one, and never fabricates data', async () => {
    const api = createApi();
    api.get.mockResolvedValueOnce({ success: false });
    const service = new SimulatorApiService(api);

    await expect(service.overview()).rejects.toThrow('Não foi possível atualizar os simulados.');
  });
});
