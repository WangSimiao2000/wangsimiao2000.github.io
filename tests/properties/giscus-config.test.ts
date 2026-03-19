/**
 * Property 15: Giscus 配置参数渲染
 * Validates: Requirements 7.2
 *
 * For any 有效的 Giscus 配置对象（repo、repoId、category、categoryId、mapping、lang），
 * 渲染的评论组件 script 标签应包含所有配置参数作为 data 属性。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { renderGiscusConfig } from '@/utils/comment';
import type { GiscusConfig } from '@/types';

/** Generate a non-empty alphanumeric-ish string suitable for Giscus config values */
const configValueArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0 && !s.includes('"') && !s.includes('<') && !s.includes('>') && !s.includes('&'));

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

describe('Feature: jekyll-to-modern-framework-migration, Property 15: Giscus config parameter rendering', () => {
  /**
   * Validates: Requirements 7.2
   * The rendered script tag should contain all config parameters as data-* attributes.
   */
  test.prop(
    [giscusConfigArb],
    { numRuns: 100 },
  )(
    'rendered HTML contains all Giscus config values as data attributes',
    (config) => {
      const html = renderGiscusConfig(config);

      // Should be a script tag
      expect(html).toContain('<script');
      expect(html).toContain('src="https://giscus.app/client.js"');

      // Should contain all config params as data-* attributes
      expect(html).toContain(`data-repo="${config.repo}"`);
      expect(html).toContain(`data-repo-id="${config.repoId}"`);
      expect(html).toContain(`data-category="${config.category}"`);
      expect(html).toContain(`data-category-id="${config.categoryId}"`);
      expect(html).toContain(`data-mapping="${config.mapping}"`);
      expect(html).toContain(`data-lang="${config.lang}"`);
    },
  );
});
