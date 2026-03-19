/**
 * Property 9: TOC 从标题自动生成
 * Validates: Requirements 4.3
 *
 * For any 包含标题标签（h2-h6）的文章内容，生成的 TOC 应包含与文章标题一一对应的条目，
 * 且条目文本与标题文本一致。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { extractHeadings } from '@/utils/toc';

/** Generate a random heading level (2-6) */
const headingLevel = fc.integer({ min: 2, max: 6 });

/** Generate a non-empty heading text (no HTML tags, no angle brackets) */
const headingText = fc.string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.replace(/[<>]/g, '').trim())
  .filter((s) => s.length > 0);

/** Generate a valid HTML id */
const headingId = fc.string({ minLength: 1, maxLength: 30 })
  .map((s) => s.replace(/[^a-zA-Z0-9-_]/g, '').trim())
  .filter((s) => s.length > 0);

/** Generate a single heading HTML element */
const headingEntry = fc.tuple(headingLevel, headingText, headingId).map(
  ([level, text, id]) => ({
    html: `<h${level} id="${id}">${text}</h${level}>`,
    level,
    text,
    id,
  })
);

describe('Feature: jekyll-to-modern-framework-migration, Property 9: TOC 从标题自动生成', () => {
  /**
   * Validates: Requirements 4.3
   * TOC entries should correspond 1:1 with headings in the HTML content,
   * and entry text should match heading text.
   */
  test.prop(
    [fc.array(headingEntry, { minLength: 1, maxLength: 10 })],
    { numRuns: 100 },
  )(
    'TOC entries correspond 1:1 with headings and text matches',
    (headings) => {
      // Build HTML content with some filler between headings
      const html = headings
        .map((h) => `<p>Some content here.</p>\n${h.html}`)
        .join('\n');

      const tocEntries = extractHeadings(html);

      // 1:1 correspondence: same number of entries
      expect(tocEntries).toHaveLength(headings.length);

      // Each entry text matches the heading text
      for (let i = 0; i < headings.length; i++) {
        expect(tocEntries[i].text).toBe(headings[i].text);
        expect(tocEntries[i].depth).toBe(headings[i].level);
        expect(tocEntries[i].id).toBe(headings[i].id);
      }
    },
  );

  /**
   * Validates: Requirements 4.3
   * HTML with no headings should produce an empty TOC.
   */
  test.prop(
    [fc.string({ minLength: 0, maxLength: 200 }).map((s) => `<p>${s.replace(/[<>]/g, '')}</p>`)],
    { numRuns: 100 },
  )(
    'no headings produces empty TOC',
    (html) => {
      const tocEntries = extractHeadings(html);
      expect(tocEntries).toHaveLength(0);
    },
  );
});
