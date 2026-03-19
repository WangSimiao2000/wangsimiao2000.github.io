/**
 * Property 18: 多语言翻译完整性
 * Validates: Requirements 9.1, 9.3
 *
 * For any UI 文本键名，zh-CN 和 en 两个 locale 文件中都应存在对应的翻译值，
 * 且翻译值为非空字符串。
 *
 * This is a data verification property test that validates the actual locale files
 * rather than using generative inputs. It ensures both locales have complete
 * translations for all UI text keys.
 */
import { describe, it, expect } from 'vitest';
import { loadLocale, clearLocaleCache } from '@/utils/i18n';

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

describe('Feature: jekyll-to-modern-framework-migration, Property 18: 多语言翻译完整性', () => {
  beforeEach(() => {
    clearLocaleCache();
  });

  it('every leaf key in zh-CN locale exists in en locale with a non-empty string value', () => {
    const zhData = loadLocale('zh-CN');
    const enData = loadLocale('en');

    const zhKeys = extractLeafKeys(zhData);
    expect(zhKeys.length).toBeGreaterThan(0);

    for (const key of zhKeys) {
      const enValue = getNestedValue(enData, key);
      expect(enValue, `en locale missing key "${key}"`).toBeDefined();
      expect(typeof enValue, `en locale key "${key}" is not a string`).toBe('string');
      expect((enValue as string).trim().length, `en locale key "${key}" is empty`).toBeGreaterThan(0);
    }
  });

  it('every leaf key in en locale exists in zh-CN locale with a non-empty string value', () => {
    const zhData = loadLocale('zh-CN');
    const enData = loadLocale('en');

    const enKeys = extractLeafKeys(enData);
    expect(enKeys.length).toBeGreaterThan(0);

    for (const key of enKeys) {
      const zhValue = getNestedValue(zhData, key);
      expect(zhValue, `zh-CN locale missing key "${key}"`).toBeDefined();
      expect(typeof zhValue, `zh-CN locale key "${key}" is not a string`).toBe('string');
      expect((zhValue as string).trim().length, `zh-CN locale key "${key}" is empty`).toBeGreaterThan(0);
    }
  });

  it('both locales have the same set of leaf keys', () => {
    const zhData = loadLocale('zh-CN');
    const enData = loadLocale('en');

    const zhKeys = new Set(extractLeafKeys(zhData));
    const enKeys = new Set(extractLeafKeys(enData));

    const onlyInZh = [...zhKeys].filter((k) => !enKeys.has(k));
    const onlyInEn = [...enKeys].filter((k) => !zhKeys.has(k));

    expect(onlyInZh, `Keys only in zh-CN: ${onlyInZh.join(', ')}`).toEqual([]);
    expect(onlyInEn, `Keys only in en: ${onlyInEn.join(', ')}`).toEqual([]);
  });

  it('all leaf values in both locales are non-empty strings', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const data = loadLocale(locale);
      const keys = extractLeafKeys(data);

      for (const key of keys) {
        const value = getNestedValue(data, key);
        expect(typeof value, `${locale} key "${key}" is not a string`).toBe('string');
        expect((value as string).trim().length, `${locale} key "${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});
