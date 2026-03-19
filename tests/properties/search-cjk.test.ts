/**
 * Property 14: 中英文搜索支持
 * Validates: Requirements 6.5
 *
 * For any 存在于索引内容中的中文或英文关键词，搜索该关键词应返回包含该关键词的结果，
 * 且结果集非空。
 *
 * Since Pagefind runs at build time and generates an index, we test the
 * highlightKeywords function with both Chinese and English text to verify
 * that the highlighting logic works correctly for both languages.
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { highlightKeywords, escapeRegex } from '@/utils/search';

/**
 * Generate a random Chinese character in the CJK Unified Ideographs range (U+4E00–U+9FFF).
 */
const chineseChar = fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp));

/**
 * Generate a non-empty Chinese keyword (1–6 characters).
 */
const chineseKeyword = fc
  .array(chineseChar, { minLength: 1, maxLength: 6 })
  .map((chars) => chars.join(''));

/**
 * Generate a non-empty English word (lowercase letters only, 2–10 chars).
 */
const englishKeyword = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 10,
  })
  .map((chars) => chars.join(''));

/**
 * Build a text string that is guaranteed to contain the given keyword,
 * surrounded by filler that won't interfere with highlighting.
 */
function textContaining(keywordArb: fc.Arbitrary<string>) {
  return keywordArb.chain((keyword) =>
    fc
      .tuple(
        fc.string({ minLength: 0, maxLength: 20 }).map((s) => s.replace(/[<>]/g, '')),
        fc.string({ minLength: 0, maxLength: 20 }).map((s) => s.replace(/[<>]/g, '')),
      )
      .map(([prefix, suffix]) => ({
        text: `${prefix}${keyword}${suffix}`,
        keyword,
      })),
  );
}

describe('Feature: jekyll-to-modern-framework-migration, Property 14: Chinese/English search support', () => {
  /**
   * Validates: Requirements 6.5
   * Chinese keywords should be correctly highlighted with <mark> tags.
   */
  test.prop([textContaining(chineseKeyword)], { numRuns: 100 })(
    'Chinese keywords are highlighted with <mark> tags',
    ({ text, keyword }) => {
      const result = highlightKeywords(text, keyword);

      // Result must contain at least one <mark> tag
      expect(result).toContain('<mark>');
      expect(result).toContain('</mark>');

      // The keyword should appear inside a <mark> tag
      const markPattern = new RegExp('<mark>' + escapeRegex(keyword) + '</mark>', 'i');
      expect(result).toMatch(markPattern);
    },
  );

  /**
   * Validates: Requirements 6.5
   * English keywords should be correctly highlighted with <mark> tags.
   */
  test.prop([textContaining(englishKeyword)], { numRuns: 100 })(
    'English keywords are highlighted with <mark> tags',
    ({ text, keyword }) => {
      const result = highlightKeywords(text, keyword);

      // Result must contain at least one <mark> tag
      expect(result).toContain('<mark>');
      expect(result).toContain('</mark>');

      // The keyword should appear inside a <mark> tag
      const markPattern = new RegExp('<mark>' + escapeRegex(keyword) + '</mark>', 'i');
      expect(result).toMatch(markPattern);
    },
  );

  /**
   * Validates: Requirements 6.5
   * Stripping <mark> tags from highlighted Chinese text should yield the original text.
   */
  test.prop([textContaining(chineseKeyword)], { numRuns: 100 })(
    'stripping <mark> tags from highlighted Chinese text yields original text',
    ({ text, keyword }) => {
      const result = highlightKeywords(text, keyword);
      const stripped = result.replace(/<\/?mark>/g, '');
      expect(stripped).toBe(text);
    },
  );

  /**
   * Validates: Requirements 6.5
   * Stripping <mark> tags from highlighted English text should yield the original text.
   */
  test.prop([textContaining(englishKeyword)], { numRuns: 100 })(
    'stripping <mark> tags from highlighted English text yields original text',
    ({ text, keyword }) => {
      const result = highlightKeywords(text, keyword);
      const stripped = result.replace(/<\/?mark>/g, '');
      expect(stripped).toBe(text);
    },
  );

  /**
   * Validates: Requirements 6.5
   * Mixed Chinese and English text should have both keywords highlighted.
   */
  test.prop([chineseKeyword, englishKeyword], { numRuns: 100 })(
    'mixed Chinese and English keywords are both highlighted in combined text',
    (cnKeyword, enKeyword) => {
      const text = `这是一段包含${cnKeyword}的中文和some ${enKeyword} English text`;
      const query = `${cnKeyword} ${enKeyword}`;

      const result = highlightKeywords(text, query);

      // Both keywords should be wrapped in <mark> tags
      const cnPattern = new RegExp('<mark>' + escapeRegex(cnKeyword) + '</mark>', 'i');
      const enPattern = new RegExp('<mark>' + escapeRegex(enKeyword) + '</mark>', 'i');
      expect(result).toMatch(cnPattern);
      expect(result).toMatch(enPattern);
    },
  );
});
