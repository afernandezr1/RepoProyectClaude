/**
 * Fallback adapter (web and any platform without a health integration).
 * Metro picks index.ios.ts / index.android.ts on those platforms.
 */
import type { HealthAdapter } from './types';

export const health: HealthAdapter = {
  platformName: 'Plataforma de salud',
  enabledInBuild: false,
  isAvailable: async () => false,
  requestPermission: async () => 'unavailable',
  readRecent: async () => [],
  manageAccessHint: 'La integración de salud solo está disponible en las versiones de iOS y Android.',
};

export * from './types';
