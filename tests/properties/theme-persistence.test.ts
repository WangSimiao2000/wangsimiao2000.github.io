/**
 * Property 12: 主题选择持久化往返
 * Validates: Requirements 5.3
 *
 * For any 主题模式值（'light' 或 'dark'），存储到 localStorage 后再读取，
 * 应得到相同的值。
 */
import { describe, expect, beforeEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { saveTheme, loadTheme } from '@/utils/theme';
import type { ThemeMode } from '@/utils/theme';

/**
 * Minimal localStorage mock for Node/Vitest environment.
 */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

/** Arbitrary that produces 'light' or 'dark' with equal probability. */
const themeModeArb: fc.Arbitrary<ThemeMode> = fc.constantFrom('light' as const, 'dark' as const);

describe('Feature: jekyll-to-modern-framework-migration, Property 12: 主题选择持久化往返', () => {
  beforeEach(() => {
    // Install a fresh localStorage mock before each test run
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    });
  });

  /**
   * Validates: Requirements 5.3
   * Roundtrip: saveTheme(mode) then loadTheme() === mode.
   */
  test.prop(
    [themeModeArb],
    { numRuns: 100 },
  )(
    'saving a theme mode and loading it back returns the same value',
    (mode) => {
      saveTheme(mode);
      const loaded = loadTheme();
      expect(loaded).toBe(mode);
    },
  );
});
