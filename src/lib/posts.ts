import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** 2024-10-19-Forward-Rendering → Forward-Rendering，与旧站 /posts/:title/ 一致 */
export const postSlug = (post: Post) => post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
export const postUrl = (post: Post) => `/posts/${postSlug(post)}/`;

/** 置顶优先，其余按日期倒序 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => Number(b.data.pin) - Number(a.data.pin) || b.data.date.valueOf() - a.data.date.valueOf());
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
