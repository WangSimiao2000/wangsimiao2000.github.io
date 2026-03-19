/**
 * Property 11: 阅读时间计算
 * Validates: Requirements 4.7
 *
 * For any 非空文章内容，计算的阅读时间应为正整数（分钟），
 * 且阅读时间应随内容长度单调递增。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { calculateReadingTime } from '@/utils/reading-time';

describe('Feature: jekyll-to-modern-framework-migration, Property 11: 阅读时间计算', () => {
  /**
   * Validates: Requirements 4.7
   * For any non-empty content, minutes must be a positive integer (>= 1).
   */
  test.prop(
    [fc.string({ minLength: 1 })],
    { numRuns: 100 },
  )(
    'reading time is always a positive integer for non-empty content',
    (content) => {
      const resultZh = calculateReadingTime(content, 'zh-CN');
      const resultEn = calculateReadingTime(content, 'en');

      // minutes must be >= 1
      expect(resultZh.minutes).toBeGreaterThanOrEqual(1);
      expect(resultEn.minutes).toBeGreaterThanOrEqual(1);

      // minutes must be an integer
      expect(Number.isInteger(resultZh.minutes)).toBe(true);
      expect(Number.isInteger(resultEn.minutes)).toBe(true);
    },
  );

  /**
   * Validates: Requirements 4.7
   * Monotonicity: if content B is content A with more text appended,
   * then readingTime(B) >= readingTime(A).
   */
  test.prop(
    [
      fc.string({ minLength: 1 }),
      fc.string({ minLength: 1 }),
    ],
    { numRuns: 100 },
  )(
    'reading time is monotonically non-decreasing as content grows',
    (base, extra) => {
      const shorter = base;
      const longer = base + ' ' + extra;

      const shortResult = calculateReadingTime(shorter, 'zh-CN');
      const longResult = calculateReadingTime(longer, 'zh-CN');

      expect(longResult.minutes).toBeGreaterThanOrEqual(shortResult.minutes);

      const shortResultEn = calculateReadingTime(shorter, 'en');
      const longResultEn = calculateReadingTime(longer, 'en');

      expect(longResultEn.minutes).toBeGreaterThanOrEqual(shortResultEn.minutes);
    },
  );
});
