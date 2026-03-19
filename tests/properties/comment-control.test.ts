/**
 * Property 16: 评论区按 Frontmatter 控制
 * Validates: Requirements 7.3
 *
 * For any Frontmatter 中 `comments` 设置为 false 的博文，
 * 渲染输出不应包含 Giscus 评论容器元素。
 * 当 comments 为 true 时，渲染输出应包含 Giscus 评论容器和配置。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { renderCommentSection } from '@/utils/comment';
import type { GiscusConfig } from '@/types';

/** Generate a non-empty string suitable for Giscus config values */
const configValueArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter(
    (s) =>
      s.trim().length > 0 &&
      !s.includes('"') &&
      !s.includes('<') &&
      !s.includes('>') &&
      !s.includes('&'),
  );

/** Generate a repo string in owner/repo format */
const repoArb = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,19}$/),
    fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,19}$/),
  )
  .map(([owner, name]) => `${owner}/${name}`);

/** Generate a mapping value */
const mappingArb = fc.constantFrom('pathname', 'url', 'title', 'og:title', 'specific', 'number');

/** Generate a lang value */
const langArb = fc.constantFrom('zh-CN', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru');

/** Generate a random GiscusConfig */
const giscusConfigArb: fc.Arbitrary<GiscusConfig> = fc.record({
  repo: repoArb,
  repoId: configValueArb,
  category: configValueArb,
  categoryId: configValueArb,
  mapping: mappingArb,
  lang: langArb,
});

describe('Feature: jekyll-to-modern-framework-migration, Property 16: Comment frontmatter control', () => {
  /**
   * Validates: Requirements 7.3
   * When enabled=false, output should not contain any Giscus or comment elements.
   */
  test.prop(
    [giscusConfigArb],
    { numRuns: 100 },
  )(
    'comments disabled: output does not contain giscus or comment elements',
    (config) => {
      const output = renderCommentSection(false, config);

      expect(output).toBe('');
      expect(output).not.toContain('giscus');
      expect(output).not.toContain('comments');
      expect(output).not.toContain('<section');
      expect(output).not.toContain('<script');
    },
  );

  /**
   * Validates: Requirements 7.3
   * When enabled=true, output should contain Giscus comment container and config.
   */
  test.prop(
    [giscusConfigArb],
    { numRuns: 100 },
  )(
    'comments enabled: output contains giscus container and config',
    (config) => {
      const output = renderCommentSection(true, config);

      // Should contain the comment section container
      expect(output).toContain('<section id="comments"');
      expect(output).toContain('giscus-container');
      expect(output).toContain('<div class="giscus">');

      // Should contain the Giscus script with config
      expect(output).toContain('giscus.app/client.js');
      expect(output).toContain(`data-repo="${config.repo}"`);
      expect(output).toContain(`data-repo-id="${config.repoId}"`);
      expect(output).toContain(`data-category="${config.category}"`);
      expect(output).toContain(`data-category-id="${config.categoryId}"`);
    },
  );
});
