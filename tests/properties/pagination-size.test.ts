/**
 * Property 5: 分页大小约束
 * Validates: Requirements 3.2
 *
 * For any 博文集合，分页后每页包含的文章数量应不超过配置的 paginate 值，
 * 且除最后一页外每页应恰好包含 paginate 篇文章。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { paginatePosts, type Post } from '@/utils/posts';

const postArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  slug: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  data: fc.record({
    title: fc.string({ minLength: 1 }),
    date: fc.date({ noInvalidDate: true }),
    categories: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 5 }),
    pin: fc.option(fc.boolean(), { nil: undefined }),
  }),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 5: 分页大小约束', () => {
  /**
   * Validates: Requirements 3.2
   * Every page must contain at most `pageSize` items,
   * and all pages except the last must contain exactly `pageSize` items.
   */
  test.prop(
    [
      fc.array(postArb, { minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1, max: 20 }),
    ],
    { numRuns: 100 },
  )(
    'each page has at most pageSize items; non-last pages have exactly pageSize items',
    (posts, pageSize) => {
      const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));

      for (let page = 1; page <= totalPages; page++) {
        const result = paginatePosts(posts as Post[], page, pageSize);

        // Every page must not exceed pageSize
        expect(result.items.length).toBeLessThanOrEqual(pageSize);

        if (page < totalPages) {
          // Non-last pages must have exactly pageSize items
          expect(result.items.length).toBe(pageSize);
        } else {
          // Last page must have between 1 and pageSize items
          const expectedLastPageSize = posts.length - (totalPages - 1) * pageSize;
          expect(result.items.length).toBe(expectedLastPageSize);
        }
      }
    },
  );

  /**
   * Validates: Requirements 3.2
   * The total number of items across all pages must equal the original list length.
   */
  test.prop(
    [
      fc.array(postArb, { minLength: 0, maxLength: 50 }),
      fc.integer({ min: 1, max: 20 }),
    ],
    { numRuns: 100 },
  )(
    'total items across all pages equals original list length',
    (posts, pageSize) => {
      const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
      let totalItems = 0;

      for (let page = 1; page <= totalPages; page++) {
        const result = paginatePosts(posts as Post[], page, pageSize);
        totalItems += result.items.length;
      }

      expect(totalItems).toBe(posts.length);
    },
  );
});
