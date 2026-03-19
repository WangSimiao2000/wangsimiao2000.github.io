/**
 * R2 environment variable validation utilities.
 *
 * Mirrors the env-var checks in scripts/sync-assets-r2.sh and
 * scripts/generate-gallery-r2.sh so the same logic can be tested
 * from TypeScript.
 */

/** Required environment variables for R2 operations */
export const R2_REQUIRED_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT_URL',
] as const;

export type R2EnvVar = (typeof R2_REQUIRED_ENV_VARS)[number];

export interface R2EnvValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Validate that all required R2 environment variables are present and non-empty.
 *
 * @param env - A record of environment variable names to their values
 * @returns Validation result with `valid` flag and list of missing variable names
 */
export function validateR2EnvVars(
  env: Record<string, string | undefined>,
): R2EnvValidationResult {
  const missing: string[] = [];

  for (const varName of R2_REQUIRED_ENV_VARS) {
    const value = env[varName];
    if (value === undefined || value === '') {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
