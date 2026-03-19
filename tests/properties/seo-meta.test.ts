/**
 * Property 20: SEO 元标签生成
 * Validates: Requirements 10.1
 *
 * For any 页面，渲染的 HTML <head> 中应包含非空的 <title> 标签、
 * <meta name="description"> 标签和 <meta property="og:title"> 标签。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateMetaTags, generatePageTitle } from '@/utils/seo';

/** Arbitrary for non-empty trimmed strings (simulating real page titles/descriptions) */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

/** Arbitrary for URL-like strings */
const urlArb = fc.webUrl();

/** Arbitrary for MetaTagsOptions */
const metaTagsOptionsArb = fc.record({
  title: nonEmptyStringArb,
  description: nonEmptyStringArb,
  url: urlArb,
  siteTitle: nonEmptyStringArb,
  ogImage: fc.option(urlArb, { nil: undefined }),
  noindex: fc.option(fc.boolean(), { nil: undefined }),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 20: SEO 元标签生成', () => {
  /**
   * Validates: Requirements 10.1
   * The generated HTML must contain a non-empty <title>, <meta description>, and <meta og:title>.
   */
  test.prop([metaTagsOptionsArb], { numRuns: 100 })(
    'generated meta tags contain non-empty title, meta description, and og:title',
    (options) => {
      const html = generateMetaTags(options);
      const pageTitle = generatePageTitle(options.title, options.siteTitle);

      // Must contain a <title> tag with non-empty content
      const titleMatch = html.match(/<title>(.+?)<\/title>/);
      expect(titleMatch).not.toBeNull();
      expect(titleMatch![1].trim().length).toBeGreaterThan(0);

      // Must contain <meta name="description"> with non-empty content
      const descMatch = html.match(/<meta name="description" content="(.+?)"/);
      expect(descMatch).not.toBeNull();
      expect(descMatch![1].trim().length).toBeGreaterThan(0);

      // Must contain <meta property="og:title"> with non-empty content
      const ogTitleMatch = html.match(/<meta property="og:title" content="(.+?)"/);
      expect(ogTitleMatch).not.toBeNull();
      expect(ogTitleMatch![1].trim().length).toBeGreaterThan(0);
    },
  );
});
