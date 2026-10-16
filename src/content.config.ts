import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse } from 'yaml';

/** 文章：沿用 Jekyll 的文件名 YYYY-MM-DD-slug.md 和 front matter */
const posts = defineCollection({
  // 默认 id 会被 slugify 成小写；旧站 URL 区分大小写，必须原样保留文件名
  loader: glob({ pattern: '*.md', base: './src/content/posts', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    math: z.boolean().default(false),
    pin: z.boolean().default(false),
  }),
});

/** YAML 数据文件不带 id，用 name 当 id，文件格式保持和原来一样，方便直接编辑 */
const byName = (text: string) =>
  (parse(text) as Record<string, unknown>[]).map((item) => ({ id: String(item.name), ...item }));

const friends = defineCollection({
  loader: file('src/data/friends.yml', { parser: byName }),
  schema: z.object({
    name: z.string(),
    url: z.url(),
    icon: z.string().optional(),
    description: z.string().optional(),
  }),
});

const tools = defineCollection({
  loader: file('src/data/tools.yml', { parser: byName }),
  schema: z.object({
    name: z.string(),
    url: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { posts, friends, tools };
