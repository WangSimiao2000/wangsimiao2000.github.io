/**
 * Property 4: 永久链接格式一致性
 * Validates: Requirements 2.5
 *
 * For any 博文，其生成的 URL 路径应匹配 /posts/{slug}/ 格式，
 * 其中 slug 与原始文件名中的标题部分一致。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateSlug, getPostUrl } from '@/utils/posts';

/**
 * Arbitrary: generate filenames in the Jekyll format YYYY-MM-DD-{title}.md
 * Title parts are alphanumeric segments joined by hyphens.
 */
const alphanumCharArb = fc.constantFrom(
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''),
);

const titleSegmentArb = fc
  .array(alphanumCharArb, { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

const titleArb = fc
  .array(titleSegmentArb, { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join('-'));

const yearArb = fc.integer({ min: 2000, max: 2099 });
const monthArb = fc.integer({ min: 1, max: 12 });
const dayArb = fc.integer({ min: 1, max: 28 });

const jekyllFilenameArb = fc
  .tuple(yearArb, monthArb, dayArb, titleArb)
  .map(([y, m, d, title]) => {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}-${title}.md`;
  });

describe('Feature: jekyll-to-modern-framework-migration, Property 4: 永久链接格式一致性', () => {
  /**
   * Validates: Requirements 2.5
   * The generated URL must match /posts/{slug}/ format.
   */
  test.prop(
    [jekyllFilenameArb],
    { numRuns: 100 },
  )(
    'generated URL matches /posts/{slug}/ format',
    (filename) => {
      const slug = generateSlug(filename);
      const url = getPostUrl(slug);

      // URL must start with /posts/ and end with /
      expect(url).toMatch(/^\/posts\/.+\/$/);

      // URL must be exactly /posts/{slug}/
      expect(url).toBe(`/posts/${slug}/`);
    },
  );

  /**
   * Validates: Requirements 2.5
   * The slug must not contain the date prefix.
   */
  test.prop(
    [jekyllFilenameArb],
    { numRuns: 100 },
  )(
    'slug does not contain date prefix',
    (filename) => {
      const slug = generateSlug(filename);

      // Slug must not start with a date pattern
      expect(slug).not.toMatch(/^\d{4}-\d{2}-\d{2}-/);
    },
  );

  /**
   * Validates: Requirements 2.5
   * The slug must not contain the .md extension.
   */
  test.prop(
    [jekyllFilenameArb],
    { numRuns: 100 },
  )(
    'slug does not contain .md extension',
    (filename) => {
      const slug = generateSlug(filename);

      expect(slug).not.toMatch(/\.md$/);
    },
  );
});
