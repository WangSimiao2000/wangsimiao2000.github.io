/**
 * Property 21: 搜索引擎验证码渲染
 * Validates: Requirements 10.4
 *
 * For any 配置的搜索引擎验证码（google、bing），渲染的 HTML <head> 中应包含
 * 对应的 <meta name="google-site-verification"> 或 <meta name="msvalidate.01"> 标签，
 * 且 content 值与配置一致。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateVerificationTags } from '@/utils/seo';

/**
 * Arbitrary for verification codes — real verification codes are alphanumeric strings.
 * Constraining to alphanumeric avoids HTML escaping issues in assertions.
 */
const verificationCodeArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,64}$/);

describe('Feature: jekyll-to-modern-framework-migration, Property 21: 搜索引擎验证码渲染', () => {
  /**
   * Validates: Requirements 10.4
   * When google verification code is configured, the output must contain
   * <meta name="google-site-verification"> with the exact content value.
   */
  test.prop(
    [verificationCodeArb],
    { numRuns: 100 },
  )(
    'google verification code renders as google-site-verification meta tag',
    (googleCode) => {
      const html = generateVerificationTags({ google: googleCode });

      const match = html.match(
        /<meta name="google-site-verification" content="(.+?)"/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).toBe(googleCode);
    },
  );

  /**
   * Validates: Requirements 10.4
   * When bing verification code is configured, the output must contain
   * <meta name="msvalidate.01"> with the exact content value.
   */
  test.prop(
    [verificationCodeArb],
    { numRuns: 100 },
  )(
    'bing verification code renders as msvalidate.01 meta tag',
    (bingCode) => {
      const html = generateVerificationTags({ bing: bingCode });

      const match = html.match(
        /<meta name="msvalidate\.01" content="(.+?)"/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).toBe(bingCode);
    },
  );

  /**
   * Validates: Requirements 10.4
   * When both codes are configured, both meta tags must be present.
   */
  test.prop(
    [verificationCodeArb, verificationCodeArb],
    { numRuns: 100 },
  )(
    'both google and bing codes render their respective meta tags',
    (googleCode, bingCode) => {
      const html = generateVerificationTags({ google: googleCode, bing: bingCode });

      expect(html).toContain('google-site-verification');
      expect(html).toContain('msvalidate.01');

      const googleMatch = html.match(
        /<meta name="google-site-verification" content="(.+?)"/,
      );
      expect(googleMatch![1]).toBe(googleCode);

      const bingMatch = html.match(
        /<meta name="msvalidate\.01" content="(.+?)"/,
      );
      expect(bingMatch![1]).toBe(bingCode);
    },
  );
});
