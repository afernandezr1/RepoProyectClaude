/**
 * Fallback adapter (web and any platform without a health integration).
 * Metro picks index.ios.ts / index.android.ts on those platforms.
 */
import type { HealthAdapter } from './types';

export const health: HealthAdapter = {
  platformName: 'Health platform',
  enabledInBuild: false,
  isAvailable: async () => false,
  requestPermission: async () => 'unavailable',
  readRecent: async () => [],
  manageAccessHint: 'Health integrations are only available on iOS and Android builds.',
};

export * from './types';
