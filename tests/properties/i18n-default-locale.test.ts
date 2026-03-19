/**
 * Property 19: 默认语言选择
 * Validates: Requirements 9.2
 *
 * For any 有效的 `lang` 配置值（'zh-CN' 或 'en'），i18n 模块返回的翻译文本
 * 应来自对应语言的 locale 文件。
 *
 * Uses fast-check to generate random locale values and verifies that t()
 * returns the correct translation from the corresponding locale file.
 */
import { describe, beforeEach, expect } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import { t, loadLocale, clearLocaleCache } from '@/utils/i18n';
import type { Locale } from '@/types';

/**
 * Recursively extract all leaf keys (keys whose values are strings)
 * from a nested object, using dot notation for the path.
 */
function extractLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      keys.push(fullKey);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...extractLeafKeys(value as Record<string, unknown>, fullKey));
    }
  }

  return keys;
}

/**
 * Get a nested value from an object using dot-separated key path.
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

describe('Feature: jekyll-to-modern-framework-migration, Property 19: 默认语言选择', () => {
  /** Preload locale data and extract shared keys for use in generators */
  const zhData = loadLocale('zh-CN');
  const enData = loadLocale('en');
  const zhKeys = extractLeafKeys(zhData);
  const enKeys = extractLeafKeys(enData);
  const sharedKeys = zhKeys.filter((k) => enKeys.includes(k));

  beforeEach(() => {
    clearLocaleCache();
  });

  fcTest.prop(
    [fc.constantFrom<Locale>('zh-CN', 'en')],
    { numRuns: 100 },
  )(
    't() with explicit locale returns text from the corresponding locale file',
    (locale) => {
      const localeData = loadLocale(locale);

      // Verify a well-known key that differs between locales
      const posted = t('post.posted', locale);
      const expectedPosted = getNestedValue(localeData, 'post.posted') as string;
      expect(posted).toBe(expectedPosted);

      // Verify the value actually differs between locales
      if (locale === 'zh-CN') {
        expect(posted).toBe('发表于');
      } else {
        expect(posted).toBe('Posted');
      }
    },
  );

  fcTest.prop(
    [fc.constantFrom<Locale>('zh-CN', 'en')],
    { numRuns: 100 },
  )(
    'all shared keys return values matching the corresponding locale file',
    (locale) => {
      const localeData = loadLocale(locale);

      for (const key of sharedKeys) {
        const result = t(key, locale);
        const expected = getNestedValue(localeData, key) as string;
        expect(result, `t("${key}", "${locale}") mismatch`).toBe(expected);
      }
    },
  );

  fcTest.prop(
    [
      fc.constantFrom<Locale>('zh-CN', 'en'),
      fc.constantFrom(...sharedKeys),
    ],
    { numRuns: 100 },
  )(
    'random locale + random key returns the value from the correct locale file',
    (locale, key) => {
      const localeData = loadLocale(locale);
      const result = t(key, locale);
      const expected = getNestedValue(localeData, key) as string;
      expect(result).toBe(expected);
    },
  );
});
