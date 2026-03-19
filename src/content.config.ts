import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    image: z.string().optional(),
    toc: z.boolean().default(true),
    comments: z.boolean().default(true),
    pin: z.boolean().default(false),
    math: z.boolean().default(false),
    mermaid: z.boolean().default(false),
    last_modified_at: z.coerce.date().optional(),
    lang: z.enum(['zh-CN', 'en']).optional(),
  }),
});

export const collections = { posts };
