import { describe, it, expect } from 'vitest';
import { shouldEnablePWA } from './pwa';

describe('shouldEnablePWA', () => {
  it('returns true when pwa.enabled is true', () => {
    expect(shouldEnablePWA({ pwa: { enabled: true } })).toBe(true);
  });

  it('returns false when pwa.enabled is false', () => {
    expect(shouldEnablePWA({ pwa: { enabled: false } })).toBe(false);
  });

  it('returns false for null/undefined config', () => {
    expect(shouldEnablePWA(null as any)).toBe(false);
    expect(shouldEnablePWA(undefined as any)).toBe(false);
  });

  it('returns false when pwa property is missing', () => {
    expect(shouldEnablePWA({} as any)).toBe(false);
  });

  it('returns false when enabled is not a boolean true', () => {
    expect(shouldEnablePWA({ pwa: { enabled: 'true' } } as any)).toBe(false);
    expect(shouldEnablePWA({ pwa: { enabled: 1 } } as any)).toBe(false);
  });
});
