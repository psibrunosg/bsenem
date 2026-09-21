import { describe, expect, it, vi } from 'vitest';
import { bootstrapAuth } from '../bootstrapAuth.js';

describe('bootstrapAuth', () => {
  it('mounts LoginPage when /auth/me returns 401', async () => {
    const deps = {
      api: { get: vi.fn().mockResolvedValue({ success: false, status: 401 }) },
      mount: vi.fn(),
      createLogin: vi.fn(() => ({ render: vi.fn(() => document.createElement('section')) })),
      createShell: vi.fn(),
    };

    await bootstrapAuth(deps);

    expect(deps.createLogin).toHaveBeenCalledOnce();
    expect(deps.createShell).not.toHaveBeenCalled();
  });

  it('mounts AppShell only with the returned user', async () => {
    const user = { id: 9, name: 'Teste', email: 'teste@exemplo.com', level: 1, xp: 0, xp_max: 1000, streak: 0, best_streak: 4 };
    const deps = {
      api: { get: vi.fn().mockResolvedValue({ success: true, data: { user } }) },
      mount: vi.fn(),
      createLogin: vi.fn(),
      createShell: vi.fn(() => ({ render: vi.fn(() => document.createElement('section')), start: vi.fn() })),
    };

    await bootstrapAuth(deps);

    expect(deps.createShell).toHaveBeenCalledWith({
      user: expect.objectContaining({ xpMax: 1000, bestStreak: 4 })
    });
  });

  it('shows a retryable unavailable state for server failures instead of pretending the user is logged out', async () => {
    const deps = {
      api: { get: vi.fn().mockResolvedValue({ success: false, status: 503 }) },
      mount: vi.fn(),
      createLogin: vi.fn(),
      createShell: vi.fn(),
    };

    const result = await bootstrapAuth(deps);
    const unavailable = deps.mount.mock.calls[0][0];

    expect(result.state).toBe('unavailable');
    expect(unavailable.textContent).toContain('Não foi possível verificar sua sessão');
    expect(unavailable.querySelector('[data-action="retry-auth"]')).not.toBeNull();
    expect(deps.createLogin).not.toHaveBeenCalled();
  });
});
