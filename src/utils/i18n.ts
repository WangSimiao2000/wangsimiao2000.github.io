/**
 * 多语言工具函数
 * 从 data/locales/*.yml 加载翻译文本，支持嵌套键名点号访问
 */
import type { Locale } from '../types';
import { siteConfig } from '../config';
import { loadLocale as loadLocaleData } from './data';

/** 缓存已加载的 locale 数据，避免重复文件读取 */
const localeCache = new Map<Locale, Record<string, unknown>>();

/**
 * 加载指定语言的 locale 数据（带缓存）
 */
export function loadLocale(locale: Locale): Record<string, unknown> {
  const cached = localeCache.get(locale);
  if (cached) return cached;

  const data = loadLocaleData(locale);
  localeCache.set(locale, data);
  return data;
}

/**
 * 通过点号分隔的键名访问嵌套对象中的值
 * 例如: getNestedValue(data, 'post.read_time.unit') => data.post.read_time.unit
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

/**
 * 获取翻译文本
 * @param key - 点号分隔的键名，如 'post.posted'、'post.read_time.unit'
 * @param locale - 目标语言，默认使用 siteConfig.lang
 * @returns 翻译文本，找不到时返回 key 本身作为 fallback
 */
export function t(key: string, locale?: Locale): string {
  const targetLocale = locale ?? siteConfig.lang;
  const data = loadLocale(targetLocale);
  const value = getNestedValue(data, key);

  if (value === undefined || value === null) {
    return key;
  }

  if (typeof value === 'string') {
    return value;
  }

  // Non-string values (objects, arrays, etc.) — return key as fallback
  return key;
}

/**
 * 清除 locale 缓存（主要用于测试）
 */
export function clearLocaleCache(): void {
  localeCache.clear();
}
