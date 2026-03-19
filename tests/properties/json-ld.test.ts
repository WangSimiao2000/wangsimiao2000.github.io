/**
 * Property 22: JSON-LD 结构化数据
 * Validates: Requirements 10.5
 *
 * For any 博文，渲染的页面应包含 <script type="application/ld+json"> 标签，
 * 其中 JSON 内容应包含 @type: "BlogPosting"、文章标题、作者名和发布日期。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateJsonLd } from '@/utils/seo';

/** Arbitrary for non-empty strings (titles, author names) */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

/** Arbitrary for valid dates */
const dateArb = fc.date({
  min: new Date('2000-01-01'),
  max: new Date('2099-12-31'),
  noInvalidDate: true,
});

/** Arbitrary for URL-like strings */
const urlArb = fc.webUrl();

/** Arbitrary for JsonLdOptions */
const jsonLdOptionsArb = fc.record({
  title: nonEmptyStringArb,
  author: nonEmptyStringArb,
  date: dateArb,
  description: fc.option(nonEmptyStringArb, { nil: undefined }),
  url: urlArb,
  image: fc.option(urlArb, { nil: undefined }),
  lastModified: fc.option(dateArb, { nil: undefined }),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 22: JSON-LD 结构化数据', () => {
  /**
   * Validates: Requirements 10.5
   * The generated JSON-LD must be wrapped in a <script type="application/ld+json"> tag
   * and contain @type: "BlogPosting", the title, author name, and published date.
   */
  test.prop([jsonLdOptionsArb], { numRuns: 100 })(
    'generated JSON-LD contains BlogPosting type, title, author, and date',
    (options) => {
      const html = generateJsonLd(options);

      // Must be wrapped in <script type="application/ld+json">
      expect(html).toContain('<script type="application/ld+json">');
      expect(html).toContain('</script>');

      // Extract JSON content
      const jsonMatch = html.match(
        /<script type="application\/ld\+json">([\s\S]+?)<\/script>/,
      );
      expect(jsonMatch).not.toBeNull();

      const jsonLd = JSON.parse(jsonMatch![1]);

      // Must contain @type: "BlogPosting"
      expect(jsonLd['@type']).toBe('BlogPosting');

      // Must contain the title
      expect(jsonLd.headline).toBe(options.title);

      // Must contain the author name
      expect(jsonLd.author).toBeDefined();
      expect(jsonLd.author.name).toBe(options.author);

      // Must contain the published date as ISO string
      expect(jsonLd.datePublished).toBe(options.date.toISOString());
    },
  );
});
