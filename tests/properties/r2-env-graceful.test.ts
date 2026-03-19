/**
 * Property 24: R2 环境变量缺失时优雅降级
 * Validates: Requirements 14.8
 *
 * For any 缺失的 R2 必需环境变量，验证函数应返回包含该变量名的错误信息，
 * 并标记验证失败（valid: false）。当所有变量都存在时应标记验证通过。
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  validateR2EnvVars,
  R2_REQUIRED_ENV_VARS,
} from '@/utils/r2';

/** Generate a non-empty string to use as an env var value */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.length > 0);

/** Generate a random subset (as a Set) of required env var names */
const subsetArb = fc
  .subarray([...R2_REQUIRED_ENV_VARS], { minLength: 0, maxLength: R2_REQUIRED_ENV_VARS.length })
  .map((arr) => new Set(arr));

describe('Feature: jekyll-to-modern-framework-migration, Property 24: R2 env var graceful degradation', () => {
  /**
   * Validates: Requirements 14.8
   * When a random subset of required vars is present, the missing ones
   * should all appear in the result's `missing` array.
   */
  test.prop(
    [subsetArb, nonEmptyStringArb],
    { numRuns: 200 },
  )(
    'missing env vars are correctly identified in validation result',
    (presentVars, value) => {
      // Build an env record where only `presentVars` have a value
      const env: Record<string, string | undefined> = {};
      for (const varName of R2_REQUIRED_ENV_VARS) {
        env[varName] = presentVars.has(varName) ? value : undefined;
      }

      const result = validateR2EnvVars(env);

      // Every var NOT in presentVars should be reported as missing
      const expectedMissing = R2_REQUIRED_ENV_VARS.filter((v) => !presentVars.has(v));

      expect(result.missing).toEqual(expectedMissing);
      expect(result.valid).toBe(expectedMissing.length === 0);
    },
  );

  /**
   * Validates: Requirements 14.8
   * When ALL required vars are present, validation should pass.
   */
  test.prop(
    [nonEmptyStringArb],
    { numRuns: 100 },
  )(
    'validation passes when all required env vars are present',
    (value) => {
      const env: Record<string, string | undefined> = {};
      for (const varName of R2_REQUIRED_ENV_VARS) {
        env[varName] = value;
      }

      const result = validateR2EnvVars(env);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    },
  );

  /**
   * Validates: Requirements 14.8
   * When NO required vars are present, all should be reported missing.
   */
  test.prop(
    [fc.constant(undefined)],
    { numRuns: 100 },
  )(
    'all vars reported missing when none are set',
    () => {
      const env: Record<string, string | undefined> = {};

      const result = validateR2EnvVars(env);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual([...R2_REQUIRED_ENV_VARS]);
    },
  );

  /**
   * Validates: Requirements 14.8
   * Empty string values should be treated as missing.
   */
  test.prop(
    [subsetArb],
    { numRuns: 200 },
  )(
    'empty string values are treated as missing',
    (emptyVars) => {
      const env: Record<string, string | undefined> = {};
      for (const varName of R2_REQUIRED_ENV_VARS) {
        env[varName] = emptyVars.has(varName) ? '' : 'some-value';
      }

      const result = validateR2EnvVars(env);

      // Vars set to empty string should be in the missing list
      for (const varName of emptyVars) {
        expect(result.missing).toContain(varName);
      }

      // Vars with actual values should NOT be in the missing list
      for (const varName of R2_REQUIRED_ENV_VARS) {
        if (!emptyVars.has(varName)) {
          expect(result.missing).not.toContain(varName);
        }
      }
    },
  );
});
