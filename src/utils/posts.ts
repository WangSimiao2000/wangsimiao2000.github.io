import { siteConfig } from '../config';

/**
 * 文章查询工具函数
 * 提供排序、分页、导航、相关文章推荐、分类/标签聚合等功能
 */

/** 文章接口 - 与 Astro CollectionEntry 兼容的最小接口 */
export interface Post {
  id: string;
  slug: string;
  data: {
    title: string;
    date: Date;
    categories: string[];
    tags: string[];
    pin?: boolean;
    description?: string;
    image?: string;
    toc?: boolean;
    comments?: boolean;
    last_modified_at?: Date;
  };
  body?: string;
}

/** 分页结果 */
export interface PaginationResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 文章导航 */
export interface PostNavigation {
  prev: Post | null;
  next: Post | null;
}

/**
 * 排序文章：置顶文章优先，然后按日期降序
 */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    // Pin status first (pinned posts come first)
    const pinA = a.data.pin ? 1 : 0;
    const pinB = b.data.pin ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;

    // Then by date descending
    return b.data.date.getTime() - a.data.date.getTime();
  });
}

/**
 * 分页文章列表
 * @param posts - 文章列表（应已排序）
 * @param page - 页码（从 1 开始）
 * @param pageSize - 每页数量，默认使用 siteConfig.paginate
 */
export function paginatePosts(
  posts: Post[],
  page: number,
  pageSize: number = siteConfig.paginate,
): PaginationResult<Post> {
  const totalItems = posts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  const items = posts.slice(start, start + pageSize);

  return {
    items,
    page: safePage,
    totalPages,
    totalItems,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

/**
 * 获取文章前后导航
 * @param posts - 已排序的文章列表
 * @param currentSlug - 当前文章的 slug
 */
export function getPostNavigation(posts: Post[], currentSlug: string): PostNavigation {
  const index = posts.findIndex((p) => p.slug === currentSlug);

  if (index === -1) {
    return { prev: null, next: null };
  }

  return {
    // In a date-descending list, "prev" is the older post (index + 1)
    prev: index < posts.length - 1 ? posts[index + 1] : null,
    // "next" is the newer post (index - 1)
    next: index > 0 ? posts[index - 1] : null,
  };
}

/**
 * 获取相关文章推荐
 * 基于共享 categories 和 tags 计算相关度
 * @param posts - 所有文章列表
 * @param currentPost - 当前文章
 * @param limit - 返回数量上限，默认 5
 */
export function getRelatedPosts(
  posts: Post[],
  currentPost: Post,
  limit: number = 5,
): Post[] {
  const currentCategories = new Set(currentPost.data.categories);
  const currentTags = new Set(currentPost.data.tags);

  const scored = posts
    .filter((p) => p.slug !== currentPost.slug)
    .map((post) => {
      let score = 0;
      // Shared categories (weight: 2)
      for (const cat of post.data.categories) {
        if (currentCategories.has(cat)) score += 2;
      }
      // Shared tags (weight: 1)
      for (const tag of post.data.tags) {
        if (currentTags.has(tag)) score += 1;
      }
      return { post, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ post }) => post);
}

/**
 * 获取所有分类及其文章数量
 */
export function getCategories(posts: Post[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const post of posts) {
    for (const cat of post.data.categories) {
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * 获取所有标签及其文章数量
 */
export function getTags(posts: Post[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * 按分类筛选文章
 */
export function getPostsByCategory(posts: Post[], category: string): Post[] {
  return posts.filter((p) => p.data.categories.includes(category));
}

/**
 * 按标签筛选文章
 */
export function getPostsByTag(posts: Post[], tag: string): Post[] {
  return posts.filter((p) => p.data.tags.includes(tag));
}

/**
 * 从文件名生成 slug
 * 去除日期前缀 (YYYY-MM-DD-) 并转换为 URL 友好格式
 *
 * 示例:
 *   "2024-10-19-Forward-Rendering-And-Deferred-Rendering.md" → "Forward-Rendering-And-Deferred-Rendering"
 *   "2022-01-12-UE5-Source-Download-Build-Run.md" → "UE5-Source-Download-Build-Run"
 */
export function generateSlug(filename: string): string {
  // Remove .md / .mdx extension
  const withoutExt = filename.replace(/\.mdx?$/, '');
  // Remove date prefix (YYYY-MM-DD-)
  const withoutDate = withoutExt.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return withoutDate;
}

/**
 * 生成文章的永久链接 URL
 * 格式: /posts/{slug}/
 */
export function getPostUrl(slug: string): string {
  return `/posts/${slug}/`;
}


/**
 * 从 Astro content collection 获取所有文章并映射为 Post 接口
 * 将 Astro 5 的 entry.id（含日期前缀）转换为 URL-friendly slug
 */
export async function getAllPosts(): Promise<Post[]> {
  const { getCollection } = await import('astro:content');
  const entries = await getCollection('posts');
  return entries.map((entry: any) => ({
    id: entry.id,
    slug: generateSlug(entry.id),
    data: entry.data,
    body: entry.body,
  }));
}

