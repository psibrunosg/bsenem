import { describe, expect, it } from 'vitest';
import packageManifest from '../../package.json' with { type: 'json' };

describe('toolchain manifest', () => {
  it('declares reproducible verification commands', () => {
    expect(packageManifest.type).toBe('module');
    expect(packageManifest.scripts.test).toBe('vitest run');
    expect(packageManifest.scripts['test:backend']).toBe('php backend/tests/auth_test.php');
    expect(packageManifest.scripts.build).toBe('vite build');
  });
});
