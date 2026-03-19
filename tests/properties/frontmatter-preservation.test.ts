/**
 * Property 1: Frontmatter 字段保留
 * Validates: Requirements 2.1
 *
 * For any Markdown 博文文件，其 Frontmatter 中的 title、date、categories、tags 字段
 * 在通过 Zod schema 解析后，值应与原始值完全一致。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { z } from 'astro/zod';

// Recreate the same Zod schema from src/content.config.ts
// (Cannot import from astro:content directly in vitest)
const postSchema = z.object({
  title: z.string(),
  date: z.date(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  image: z.string().optional(),
  toc: z.boolean().default(true),
  comments: z.boolean().default(true),
  pin: z.boolean().default(false),
  math: z.boolean().default(false),
  mermaid: z.boolean().default(false),
  last_modified_at: z.date().optional(),
  lang: z.enum(['zh-CN', 'en']).optional(),
});

// Arbitrary for generating random Frontmatter objects
const frontmatterArb = fc.record({
  title: fc.string({ minLength: 1 }),
  date: fc.date({ noInvalidDate: true }),
  categories: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 5 }),
  tags: fc.array(fc.string({ minLength: 1 }), { minLength: 0, maxLength: 10 }),
  description: fc.option(fc.string(), { nil: undefined }),
  image: fc.option(fc.string(), { nil: undefined }),
  toc: fc.boolean(),
  comments: fc.boolean(),
  pin: fc.boolean(),
  math: fc.boolean(),
  mermaid: fc.boolean(),
  last_modified_at: fc.option(fc.date({ noInvalidDate: true }), { nil: undefined }),
  lang: fc.option(fc.constantFrom('zh-CN' as const, 'en' as const), { nil: undefined }),
});

describe('Feature: jekyll-to-modern-framework-migration, Property 1: Frontmatter 字段保留', () => {
  test.prop([frontmatterArb], { numRuns: 100 })(
    'title, date, categories, tags fields are preserved after Zod schema parsing',
    (frontmatter) => {
      const parsed = postSchema.parse(frontmatter);

      // title must be preserved exactly
      expect(parsed.title).toBe(frontmatter.title);

      // date must be preserved exactly (same timestamp)
      expect(parsed.date.getTime()).toBe(frontmatter.date.getTime());

      // categories must be preserved exactly
      expect(parsed.categories).toEqual(frontmatter.categories);

      // tags must be preserved exactly
      expect(parsed.tags).toEqual(frontmatter.tags);
    },
  );
});
