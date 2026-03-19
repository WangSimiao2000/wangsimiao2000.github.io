/**
 * Property 7: 相关文章共享标签或分类
 * Validates: Requirements 3.4
 *
 * For any 博文及其推荐的相关文章列表，列表中的每篇文章应与当前文章至少共享一个 category 或 tag。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { getRelatedPosts, type Post } from '@/utils/posts';

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

describe('Feature: jekyll-to-modern-framework-migration, Property 7: 相关文章共享标签或分类', () => {
  /**
   * Validates: Requirements 3.4
   * Every related post must share at least one category or tag with the current post.
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
    'every related post shares at least one category or tag with the current post',
    (posts) => {
      const typedPosts = posts as Post[];

      for (const currentPost of typedPosts) {
        const related = getRelatedPosts(typedPosts, currentPost);

        const currentCategories = new Set(currentPost.data.categories);
        const currentTags = new Set(currentPost.data.tags);

        for (const relatedPost of related) {
          // Must not be the same post
          expect(relatedPost.slug).not.toBe(currentPost.slug);

          // Must share at least one category or tag
          const sharedCategory = relatedPost.data.categories.some(c => currentCategories.has(c));
          const sharedTag = relatedPost.data.tags.some(t => currentTags.has(t));

          expect(
            sharedCategory || sharedTag,
            `Related post "${relatedPost.slug}" shares no category or tag with "${currentPost.slug}"`,
          ).toBe(true);
        }
      }
    },
  );
});
