const THEMES = ['light', 'dark', 'system'];

export function normalizeThemePreference(value) {
  return THEMES.includes(value) ? value : 'system';
}

export function resolveTheme(preference, systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false) {
  const normalized = normalizeThemePreference(preference);
  return normalized === 'system' ? (systemDark ? 'dark' : 'light') : normalized;
}

export function applyThemePreference(preference, { persist = true } = {}) {
  const normalized = normalizeThemePreference(preference);
  const resolved = resolveTheme(normalized);
  document.documentElement.setAttribute('data-theme', resolved);
  if (persist) localStorage.setItem('theme', normalized);
  return { preference: normalized, resolved };
}

export function restoreThemePreference() {
  return applyThemePreference(localStorage.getItem('theme'), { persist: false });
}
