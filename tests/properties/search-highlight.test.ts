/**
 * Property 13: 搜索关键词高亮
 * Validates: Requirements 6.4
 *
 * For any 搜索查询和匹配结果，结果中应包含被高亮标记包裹的查询关键词文本。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { highlightKeywords, escapeRegex } from '@/utils/search';

/**
 * Generate a single non-empty word using distinct characters to avoid
 * substring overlap issues in regex alternation.
 * Each generated word uses characters from a distinct range so that
 * multi-word queries don't have one word being a substring of another.
 */
const safeWord = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 10 })
  .map((chars) => chars.join(''))
  .filter((s) => s.trim().length >= 2);

/**
 * Generate a list of distinct words (no word is a substring of another)
 * to avoid regex alternation order issues.
 */
const distinctWords = fc
  .array(safeWord, { minLength: 1, maxLength: 3 })
  .filter((words) => {
    // Ensure no word is a substring of another (case-insensitive)
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words.length; j++) {
        if (i !== j && words[j].toLowerCase().includes(words[i].toLowerCase())) {
          return false;
        }
      }
    }
    return true;
  });

/**
 * Generate a correlated { text, query } pair where the text is guaranteed
 * to contain every word of the query.
 */
const textWithQueryArb = distinctWords.chain((queryWords) => {
  const query = queryWords.join(' ');
  return fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.replace(/[<>]/g, '')),
      fc.string({ minLength: 0, maxLength: 30 }).map((s) => s.replace(/[<>]/g, '')),
    )
    .map(([prefix, suffix]) => ({
      text: `${prefix} ${query} ${suffix}`,
      query,
    }));
});

describe('Feature: jekyll-to-modern-framework-migration, Property 13: Search keyword highlighting', () => {
  /**
   * Validates: Requirements 6.4
   * When the query appears in the text, the output should contain <mark> wrapped keywords.
   */
  test.prop(
    [textWithQueryArb],
    { numRuns: 100 },
  )(
    'highlighted output contains <mark> tags wrapping matched keywords',
    ({ text, query }) => {
      const result = highlightKeywords(text, query);

      // The result must contain at least one <mark> tag
      expect(result).toContain('<mark>');
      expect(result).toContain('</mark>');

      // Each query word should appear inside a <mark> tag
      const words = query.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const markPattern = new RegExp(
          '<mark>' + escapeRegex(word) + '</mark>',
          'i',
        );
        expect(result).toMatch(markPattern);
      }
    },
  );

  /**
   * Validates: Requirements 6.4
   * Highlighting should preserve the original text content (stripping <mark> tags
   * should yield the original text).
   */
  test.prop(
    [textWithQueryArb],
    { numRuns: 100 },
  )(
    'stripping <mark> tags from highlighted output yields original text',
    ({ text, query }) => {
      const result = highlightKeywords(text, query);
      const stripped = result.replace(/<\/?mark>/g, '');
      expect(stripped).toBe(text);
    },
  );

  /**
   * Validates: Requirements 6.4
   * Empty or whitespace-only query should return text unchanged.
   */
  test.prop(
    [fc.string({ minLength: 1, maxLength: 100 }), fc.constantFrom('', '  ', '\t', '\n')],
    { numRuns: 100 },
  )(
    'empty or whitespace query returns text unchanged',
    (text, emptyQuery) => {
      const result = highlightKeywords(text, emptyQuery);
      expect(result).toBe(text);
    },
  );
});
