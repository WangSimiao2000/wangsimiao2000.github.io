/**
 * PWA utility functions
 *
 * Provides testable logic for PWA feature control.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

interface PWAConfig {
  pwa: {
    enabled: boolean;
  };
}

/**
 * Determines whether PWA features should be enabled based on site configuration.
 *
 * @param config - Object containing pwa.enabled boolean
 * @returns true if PWA should be enabled, false otherwise
 */
export function shouldEnablePWA(config: PWAConfig): boolean {
  return config?.pwa?.enabled === true;
}
