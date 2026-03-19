import { describe, it, expect, beforeEach } from 'vitest';
import { t, loadLocale, clearLocaleCache } from './i18n';

describe('i18n utilities', () => {
  beforeEach(() => {
    clearLocaleCache();
  });

  describe('loadLocale', () => {
    it('should load zh-CN locale data', () => {
      const data = loadLocale('zh-CN');
      expect(data).toHaveProperty('layout');
      expect(data).toHaveProperty('tabs');
      expect(data).toHaveProperty('post');
    });

    it('should load en locale data', () => {
      const data = loadLocale('en');
      expect(data).toHaveProperty('layout');
      expect(data).toHaveProperty('tabs');
      expect(data).toHaveProperty('post');
    });

    it('should cache loaded locale data', () => {
      const first = loadLocale('zh-CN');
      const second = loadLocale('zh-CN');
      expect(first).toBe(second); // same reference = cached
    });
  });

  describe('t', () => {
    it('should return translation for top-level key', () => {
      expect(t('tabs.home', 'zh-CN')).toBe('首页');
      expect(t('tabs.home', 'en')).toBe('Home');
    });

    it('should support nested key access with dot notation', () => {
      expect(t('post.posted', 'zh-CN')).toBe('发表于');
      expect(t('post.posted', 'en')).toBe('Posted');
    });

    it('should support deeply nested keys', () => {
      expect(t('post.read_time.unit', 'zh-CN')).toBe('分钟');
      expect(t('post.read_time.unit', 'en')).toBe('min');
    });

    it('should support triple-nested keys', () => {
      expect(t('post.button.copy_code.succeed', 'zh-CN')).toBe('已复制！');
      expect(t('post.button.copy_code.succeed', 'en')).toBe('Copied!');
    });

    it('should default to siteConfig.lang (zh-CN) when no locale specified', () => {
      // siteConfig.lang is 'zh-CN'
      expect(t('post.posted')).toBe('发表于');
    });

    it('should return key itself when translation is not found', () => {
      expect(t('nonexistent.key', 'zh-CN')).toBe('nonexistent.key');
    });

    it('should return key when partial path exists but final key is missing', () => {
      expect(t('post.nonexistent', 'zh-CN')).toBe('post.nonexistent');
    });

    it('should return key when accessing a non-string value (object)', () => {
      // 'post.read_time' is an object, not a string
      expect(t('post.read_time', 'zh-CN')).toBe('post.read_time');
    });
  });
});
