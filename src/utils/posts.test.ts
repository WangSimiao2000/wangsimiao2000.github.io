import { describe, it, expect } from 'vitest';
import {
  sortPosts,
  paginatePosts,
  getPostNavigation,
  getRelatedPosts,
  getCategories,
  getTags,
  getPostsByCategory,
  getPostsByTag,
  generateSlug,
  getPostUrl,
  type Post,
} from './posts';

/** Helper to create a test post */
function makePost(
  slug: string,
  date: Date,
  opts: { categories?: string[]; tags?: string[]; pin?: boolean } = {},
): Post {
  return {
    slug,
    data: {
      title: `Post ${slug}`,
      date,
      categories: opts.categories ?? [],
      tags: opts.tags ?? [],
      pin: opts.pin,
    },
  };
}

describe('sortPosts', () => {
  it('should sort by date descending', () => {
    const posts = [
      makePost('old', new Date(2023, 0, 1)),
      makePost('new', new Date(2024, 0, 1)),
      makePost('mid', new Date(2023, 6, 1)),
    ];
    const sorted = sortPosts(posts);
    expect(sorted.map((p) => p.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('should put pinned posts first', () => {
    const posts = [
      makePost('normal', new Date(2024, 0, 1)),
      makePost('pinned', new Date(2023, 0, 1), { pin: true }),
    ];
    const sorted = sortPosts(posts);
    expect(sorted[0].slug).toBe('pinned');
  });

  it('should sort pinned posts by date among themselves', () => {
    const posts = [
      makePost('pin-old', new Date(2023, 0, 1), { pin: true }),
      makePost('pin-new', new Date(2024, 0, 1), { pin: true }),
      makePost('normal', new Date(2024, 6, 1)),
    ];
    const sorted = sortPosts(posts);
    expect(sorted.map((p) => p.slug)).toEqual(['pin-new', 'pin-old', 'normal']);
  });

  it('should not mutate the original array', () => {
    const posts = [
      makePost('b', new Date(2023, 0, 1)),
      makePost('a', new Date(2024, 0, 1)),
    ];
    const original = [...posts];
    sortPosts(posts);
    expect(posts).toEqual(original);
  });

  it('should handle empty array', () => {
    expect(sortPosts([])).toEqual([]);
  });
});

describe('paginatePosts', () => {
  const posts = Array.from({ length: 25 }, (_, i) =>
    makePost(`post-${i}`, new Date(2024, 0, 25 - i)),
  );

  it('should return correct page size', () => {
    const result = paginatePosts(posts, 1, 10);
    expect(result.items).toHaveLength(10);
  });

  it('should return correct total pages', () => {
    const result = paginatePosts(posts, 1, 10);
    expect(result.totalPages).toBe(3);
    expect(result.totalItems).toBe(25);
  });

  it('should return last page with remaining items', () => {
    const result = paginatePosts(posts, 3, 10);
    expect(result.items).toHaveLength(5);
  });

  it('should set hasNext and hasPrev correctly', () => {
    expect(paginatePosts(posts, 1, 10).hasNext).toBe(true);
    expect(paginatePosts(posts, 1, 10).hasPrev).toBe(false);
    expect(paginatePosts(posts, 2, 10).hasNext).toBe(true);
    expect(paginatePosts(posts, 2, 10).hasPrev).toBe(true);
    expect(paginatePosts(posts, 3, 10).hasNext).toBe(false);
    expect(paginatePosts(posts, 3, 10).hasPrev).toBe(true);
  });

  it('should clamp page to valid range', () => {
    const result = paginatePosts(posts, 100, 10);
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(5);
  });

  it('should clamp page 0 to 1', () => {
    const result = paginatePosts(posts, 0, 10);
    expect(result.page).toBe(1);
  });

  it('should handle empty posts', () => {
    const result = paginatePosts([], 1, 10);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
    expect(result.totalItems).toBe(0);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });

  it('should use default page size from config', () => {
    const result = paginatePosts(posts, 1);
    // siteConfig.paginate is 10
    expect(result.items).toHaveLength(10);
  });
});

describe('getPostNavigation', () => {
  const posts = [
    makePost('newest', new Date(2024, 2, 1)),
    makePost('middle', new Date(2024, 1, 1)),
    makePost('oldest', new Date(2024, 0, 1)),
  ];

  it('should return prev and next for middle post', () => {
    const nav = getPostNavigation(posts, 'middle');
    expect(nav.prev?.slug).toBe('oldest');
    expect(nav.next?.slug).toBe('newest');
  });

  it('should return null next for first post', () => {
    const nav = getPostNavigation(posts, 'newest');
    expect(nav.next).toBeNull();
    expect(nav.prev?.slug).toBe('middle');
  });

  it('should return null prev for last post', () => {
    const nav = getPostNavigation(posts, 'oldest');
    expect(nav.prev).toBeNull();
    expect(nav.next?.slug).toBe('middle');
  });

  it('should return null for both when slug not found', () => {
    const nav = getPostNavigation(posts, 'nonexistent');
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });

  it('should return null for both when single post', () => {
    const nav = getPostNavigation([posts[0]], 'newest');
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });
});

describe('getRelatedPosts', () => {
  const current = makePost('current', new Date(2024, 0, 1), {
    categories: ['tech', 'web'],
    tags: ['astro', 'typescript'],
  });

  const related1 = makePost('related1', new Date(2024, 0, 2), {
    categories: ['tech'],
    tags: ['astro'],
  });

  const related2 = makePost('related2', new Date(2024, 0, 3), {
    categories: ['web'],
    tags: ['react'],
  });

  const unrelated = makePost('unrelated', new Date(2024, 0, 4), {
    categories: ['cooking'],
    tags: ['recipe'],
  });

  const allPosts = [current, related1, related2, unrelated];

  it('should return posts sharing categories or tags', () => {
    const result = getRelatedPosts(allPosts, current);
    const slugs = result.map((p) => p.slug);
    expect(slugs).toContain('related1');
    expect(slugs).toContain('related2');
    expect(slugs).not.toContain('unrelated');
  });

  it('should not include the current post', () => {
    const result = getRelatedPosts(allPosts, current);
    expect(result.find((p) => p.slug === 'current')).toBeUndefined();
  });

  it('should rank by relevance (more shared = higher)', () => {
    const result = getRelatedPosts(allPosts, current);
    // related1 shares 'tech' (2) + 'astro' (1) = 3
    // related2 shares 'web' (2) = 2
    expect(result[0].slug).toBe('related1');
    expect(result[1].slug).toBe('related2');
  });

  it('should respect limit parameter', () => {
    const result = getRelatedPosts(allPosts, current, 1);
    expect(result).toHaveLength(1);
  });

  it('should return empty for post with no shared categories/tags', () => {
    const result = getRelatedPosts(allPosts, unrelated);
    expect(result).toHaveLength(0);
  });

  it('should return empty for empty posts list', () => {
    const result = getRelatedPosts([], current);
    expect(result).toHaveLength(0);
  });
});

describe('getCategories', () => {
  it('should count posts per category', () => {
    const posts = [
      makePost('a', new Date(), { categories: ['tech', 'web'] }),
      makePost('b', new Date(), { categories: ['tech'] }),
      makePost('c', new Date(), { categories: ['life'] }),
    ];
    const cats = getCategories(posts);
    expect(cats.get('tech')).toBe(2);
    expect(cats.get('web')).toBe(1);
    expect(cats.get('life')).toBe(1);
  });

  it('should return empty map for empty posts', () => {
    expect(getCategories([]).size).toBe(0);
  });
});

describe('getTags', () => {
  it('should count posts per tag', () => {
    const posts = [
      makePost('a', new Date(), { tags: ['astro', 'ts'] }),
      makePost('b', new Date(), { tags: ['astro'] }),
    ];
    const tags = getTags(posts);
    expect(tags.get('astro')).toBe(2);
    expect(tags.get('ts')).toBe(1);
  });

  it('should return empty map for empty posts', () => {
    expect(getTags([]).size).toBe(0);
  });
});

describe('getPostsByCategory', () => {
  const posts = [
    makePost('a', new Date(), { categories: ['tech'] }),
    makePost('b', new Date(), { categories: ['life'] }),
    makePost('c', new Date(), { categories: ['tech', 'life'] }),
  ];

  it('should filter posts by category', () => {
    const result = getPostsByCategory(posts, 'tech');
    expect(result.map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('should return empty for non-existent category', () => {
    expect(getPostsByCategory(posts, 'nonexistent')).toEqual([]);
  });
});

describe('getPostsByTag', () => {
  const posts = [
    makePost('a', new Date(), { tags: ['astro'] }),
    makePost('b', new Date(), { tags: ['react'] }),
    makePost('c', new Date(), { tags: ['astro', 'react'] }),
  ];

  it('should filter posts by tag', () => {
    const result = getPostsByTag(posts, 'astro');
    expect(result.map((p) => p.slug)).toEqual(['a', 'c']);
  });

  it('should return empty for non-existent tag', () => {
    expect(getPostsByTag(posts, 'nonexistent')).toEqual([]);
  });
});

describe('generateSlug', () => {
  it('should remove date prefix and .md extension', () => {
    expect(generateSlug('2024-10-19-Forward-Rendering-And-Deferred-Rendering.md'))
      .toBe('Forward-Rendering-And-Deferred-Rendering');
  });

  it('should handle another date-prefixed filename', () => {
    expect(generateSlug('2022-01-12-UE5-Source-Download-Build-Run.md'))
      .toBe('UE5-Source-Download-Build-Run');
  });

  it('should handle .mdx extension', () => {
    expect(generateSlug('2023-06-15-My-Post.mdx'))
      .toBe('My-Post');
  });

  it('should handle filename without date prefix', () => {
    expect(generateSlug('some-post-title.md'))
      .toBe('some-post-title');
  });

  it('should handle filename without extension', () => {
    expect(generateSlug('2024-01-01-No-Extension'))
      .toBe('No-Extension');
  });
});

describe('getPostUrl', () => {
  it('should generate /posts/{slug}/ format', () => {
    expect(getPostUrl('Forward-Rendering-And-Deferred-Rendering'))
      .toBe('/posts/Forward-Rendering-And-Deferred-Rendering/');
  });

  it('should handle simple slug', () => {
    expect(getPostUrl('hello-world')).toBe('/posts/hello-world/');
  });
});
