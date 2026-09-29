import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemePreference, restoreThemePreference } from '../utils/theme.js';

describe('theme preference', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('persists explicit light and dark preferences', () => {
    applyThemePreference('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    applyThemePreference('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('resolves system preference from prefers-color-scheme while persisting system', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    applyThemePreference('system');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('restores the saved browser preference without overwriting it', () => {
    localStorage.setItem('theme', 'light');

    const result = restoreThemePreference();

    expect(result).toEqual({ preference: 'light', resolved: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
