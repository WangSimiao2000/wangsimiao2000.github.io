/**
 * Property 3: 最后修改日期显示
 * Validates: Requirements 2.4
 *
 * For any 包含 last_modified_at 字段的博文，渲染输出的 HTML 中应同时包含
 * 发布日期和最后修改日期两个日期字符串。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { renderPostDates } from '@/utils/post-render';
import { formatDate } from '@/utils/date';
import type { Locale } from '@/types';

/** Arbitrary for valid dates (no invalid dates) */
const dateArb = fc.date({
  min: new Date('2000-01-01'),
  max: new Date('2099-12-31'),
  noInvalidDate: true,
});

/** Arbitrary for locale */
const localeArb: fc.Arbitrary<Locale> = fc.constantFrom('zh-CN' as const, 'en' as const);

describe('Feature: jekyll-to-modern-framework-migration, Property 3: 最后修改日期显示', () => {
  /**
   * Validates: Requirements 2.4
   * When last_modified_at is provided, the rendered output must contain
   * both the published date and the last modified date.
   */
  test.prop(
    [dateArb, dateArb, localeArb],
    { numRuns: 100 },
  )(
    'post with last_modified_at shows both published date and modified date',
    (publishDate, modifiedDate, locale) => {
      const html = renderPostDates(publishDate, modifiedDate, locale);

      const formattedPublish = formatDate(publishDate, locale);
      const formattedModified = formatDate(modifiedDate, locale);

      // Must contain the published date
      expect(html).toContain(formattedPublish);

      // Must contain the modified date
      expect(html).toContain(formattedModified);

      // Must contain both date-related class markers
      expect(html).toContain('post-date');
      expect(html).toContain('post-updated');

      // Must contain both datetime attributes
      expect(html).toContain(publishDate.toISOString());
      expect(html).toContain(modifiedDate.toISOString());
    },
  );

  /**
   * Validates: Requirements 2.4
   * When last_modified_at is NOT provided, only the published date should appear.
   */
  test.prop(
    [dateArb, localeArb],
    { numRuns: 100 },
  )(
    'post without last_modified_at shows only published date',
    (publishDate, locale) => {
      const html = renderPostDates(publishDate, undefined, locale);

      const formattedPublish = formatDate(publishDate, locale);

      // Must contain the published date
      expect(html).toContain(formattedPublish);
      expect(html).toContain('post-date');

      // Must NOT contain the modified date section
      expect(html).not.toContain('post-updated');
    },
  );
});
