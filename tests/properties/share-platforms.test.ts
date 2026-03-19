/**
 * Property 10: 分享平台从配置生成
 * Validates: Requirements 4.6
 *
 * For any 分享平台配置列表，渲染的分享组件应为每个配置的平台生成对应的分享链接。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateShareLinks } from '@/utils/share';
import type { SharePlatform } from '@/utils/data';

/** Generate a random share platform config */
const sharePlatformArb = fc.record({
  type: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  icon: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  link: fc.constantFrom(
    'https://twitter.com/intent/tweet?text=TITLE&url=URL',
    'https://www.facebook.com/sharer/sharer.php?title=TITLE&u=URL',
    'https://t.me/share/url?url=URL&text=TITLE',
    'https://service.weibo.com/share/share.php?title=TITLE&url=URL',
  ),
}) as fc.Arbitrary<SharePlatform>;

/** Generate a valid URL */
const urlArb = fc.webUrl();

/** Generate a non-empty title */
const titleArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

describe('Feature: jekyll-to-modern-framework-migration, Property 10: 分享平台从配置生成', () => {
  /**
   * Validates: Requirements 4.6
   * Each configured platform should produce a corresponding share link.
   */
  test.prop(
    [fc.array(sharePlatformArb, { minLength: 1, maxLength: 8 }), urlArb, titleArb],
    { numRuns: 100 },
  )(
    'generates one share link per configured platform',
    (platforms, postUrl, postTitle) => {
      const links = generateShareLinks(platforms, postUrl, postTitle);

      // 1:1 correspondence
      expect(links).toHaveLength(platforms.length);

      // Each link matches its platform
      for (let i = 0; i < platforms.length; i++) {
        expect(links[i].type).toBe(platforms[i].type);
        expect(links[i].icon).toBe(platforms[i].icon);
        // URL should contain the encoded post URL
        expect(links[i].url).toContain(encodeURIComponent(postUrl));
        // URL should contain the encoded post title
        expect(links[i].url).toContain(encodeURIComponent(postTitle));
      }
    },
  );

  /**
   * Validates: Requirements 4.6
   * Empty platform list should produce empty share links.
   */
  test.prop(
    [urlArb, titleArb],
    { numRuns: 100 },
  )(
    'empty platform list produces no share links',
    (postUrl, postTitle) => {
      const links = generateShareLinks([], postUrl, postTitle);
      expect(links).toHaveLength(0);
    },
  );
});
