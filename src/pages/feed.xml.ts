import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { siteConfig } from '../config';
import { sortPosts, getPostUrl } from '../utils/posts';

export async function GET(context: APIContext) {
  const allPosts = await getCollection('posts');

  const sorted = sortPosts(
    allPosts.map((post) => ({
      slug: post.id,
      data: post.data,
    })),
  );

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site?.toString() ?? siteConfig.url,
    items: sorted.map((post) => ({
      title: post.data.title,
      description: post.data.description ?? '',
      link: getPostUrl(post.slug),
      pubDate: post.data.date,
    })),
  });
}
