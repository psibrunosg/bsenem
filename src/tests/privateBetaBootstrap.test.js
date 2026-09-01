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
    const user = { id: 9, name: 'Teste', email: 'teste@exemplo.com', level: 1, xp: 0, streak: 0 };
    const deps = {
      api: { get: vi.fn().mockResolvedValue({ success: true, data: { user } }) },
      mount: vi.fn(),
      createLogin: vi.fn(),
      createShell: vi.fn(() => ({ render: vi.fn(() => document.createElement('section')), start: vi.fn() })),
    };

    await bootstrapAuth(deps);

    expect(deps.createShell).toHaveBeenCalledWith(expect.objectContaining({ user }));
  });
});
