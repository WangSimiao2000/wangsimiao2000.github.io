/**
 * Property 6: 文章前后导航
 * Validates: Requirements 3.3
 *
 * For any 按日期排序的博文列表中的文章，若该文章不是第一篇则应有"上一篇"链接，
 * 若不是最后一篇则应有"下一篇"链接，且链接指向的文章应与排序顺序一致。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { sortPosts, getPostNavigation, type Post } from '@/utils/posts';

const postArb = fc.record({
  slug: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  data: fc.record({
    title: fc.string({ minLength: 1 }),
    date: fc.date({ noInvalidDate: true }),
    categories: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 3 }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 5 }),
    pin: fc.option(fc.boolean(), { nil: undefined }),
  }),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 6: 文章前后导航', () => {
  /**
   * Validates: Requirements 3.3
   * For a sorted list with unique slugs:
   * - The first post has no "next" (newer) post, but has a "prev" (older) post (unless it's the only one)
   * - The last post has no "prev" (older) post, but has a "next" (newer) post (unless it's the only one)
   * - Middle posts have both prev and next
   * - Navigation links match the sorted order
   */
  test.prop(
    [
      fc.array(postArb, { minLength: 2, maxLength: 30 })
        .map(posts => {
          // Ensure unique slugs by appending index
          return posts.map((p, i) => ({ ...p, slug: `${p.slug}-${i}` }));
        }),
    ],
    { numRuns: 100 },
  )(
    'non-first posts have prev link, non-last posts have next link, links match sort order',
    (posts) => {
      const sorted = sortPosts(posts as Post[]);

      for (let i = 0; i < sorted.length; i++) {
        const nav = getPostNavigation(sorted, sorted[i].slug);

        if (i === 0) {
          // First in sorted list (newest) — no "next" (newer)
          expect(nav.next).toBeNull();
        } else {
          // Has a "next" (newer) post — should be the previous item in sorted array
          expect(nav.next).not.toBeNull();
          expect(nav.next!.slug).toBe(sorted[i - 1].slug);
        }

        if (i === sorted.length - 1) {
          // Last in sorted list (oldest) — no "prev" (older)
          expect(nav.prev).toBeNull();
        } else {
          // Has a "prev" (older) post — should be the next item in sorted array
          expect(nav.prev).not.toBeNull();
          expect(nav.prev!.slug).toBe(sorted[i + 1].slug);
        }
      }
    },
  );
});
