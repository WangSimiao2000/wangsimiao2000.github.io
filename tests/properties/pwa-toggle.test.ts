/**
 * Property 17: PWA 配置开关
 * Validates: Requirements 8.4
 *
 * For any PWA 配置状态（enabled/disabled），当 `pwa.enabled` 为 false 时，
 * shouldEnablePWA 返回 false；为 true 时返回 true。
 * 对于非布尔值的 pwa.enabled，shouldEnablePWA 应严格返回 false。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { shouldEnablePWA } from '@/utils/pwa';

describe('Feature: jekyll-to-modern-framework-migration, Property 17: PWA config toggle', () => {
  /**
   * Validates: Requirements 8.4
   * When pwa.enabled is true, shouldEnablePWA returns true.
   */
  test.prop(
    [fc.constant(true)],
    { numRuns: 100 },
  )(
    'pwa.enabled=true: shouldEnablePWA returns true',
    (enabled) => {
      const config = { pwa: { enabled } };
      expect(shouldEnablePWA(config)).toBe(true);
    },
  );

  /**
   * Validates: Requirements 8.4
   * When pwa.enabled is false, shouldEnablePWA returns false.
   */
  test.prop(
    [fc.constant(false)],
    { numRuns: 100 },
  )(
    'pwa.enabled=false: shouldEnablePWA returns false',
    (enabled) => {
      const config = { pwa: { enabled } };
      expect(shouldEnablePWA(config)).toBe(false);
    },
  );

  /**
   * Validates: Requirements 8.4
   * When pwa.enabled is a random boolean, the result matches the boolean value exactly.
   */
  test.prop(
    [fc.boolean()],
    { numRuns: 100 },
  )(
    'pwa.enabled boolean: shouldEnablePWA returns the same boolean',
    (enabled) => {
      const config = { pwa: { enabled } };
      expect(shouldEnablePWA(config)).toBe(enabled);
    },
  );

  /**
   * Validates: Requirements 8.4
   * When pwa.enabled is a non-boolean value, shouldEnablePWA strictly returns false.
   * This ensures strict boolean checking (=== true).
   */
  test.prop(
    [fc.oneof(
      fc.string(),
      fc.integer(),
      fc.constant(null),
      fc.constant(undefined),
      fc.constant(0),
      fc.constant(1),
      fc.constant('true'),
      fc.constant('false'),
      fc.object(),
      fc.array(fc.anything()),
    )],
    { numRuns: 100 },
  )(
    'pwa.enabled non-boolean: shouldEnablePWA returns false',
    (nonBooleanValue) => {
      const config = { pwa: { enabled: nonBooleanValue as any } };
      expect(shouldEnablePWA(config)).toBe(false);
    },
  );
});
