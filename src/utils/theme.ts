/**
 * Theme utility functions for light/dark mode management.
 * Extracted for testability and reuse across components.
 */

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme-mode';

/**
 * Save the selected theme mode to localStorage.
 */
export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * Load the saved theme mode from localStorage.
 * Returns null if no theme has been saved.
 */
export function loadTheme(): ThemeMode | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return null;
}

/**
 * Apply the given theme mode to the document by setting the data-mode attribute.
 * For 'light' mode, the attribute is removed (falls back to :root defaults).
 * For 'dark' mode, data-mode="dark" is set.
 */
export function applyTheme(mode: ThemeMode): void {
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-mode', 'dark');
  } else {
    document.documentElement.removeAttribute('data-mode');
  }
}

/**
 * Get the preferred theme based on the OS prefers-color-scheme media query.
 */
export function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Resolve the current theme: saved preference takes priority, then system preference.
 */
export function resolveTheme(): ThemeMode {
  return loadTheme() ?? getSystemTheme();
}
