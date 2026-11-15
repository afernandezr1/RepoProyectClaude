/**
 * Dynamic config layered on app.json.
 *
 * Health integrations are OFF unless EXPO_PUBLIC_HEALTH_ENABLED=true (set in
 * .env). Only then are the HealthKit / Health Connect native plugins and
 * permissions added to the build. Read-only access is requested: no write
 * permissions are declared.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

const HEALTH_ENABLED = process.env.EXPO_PUBLIC_HEALTH_ENABLED === 'true';
/** Single-page browser build published as a Claude page (npm run build:page). */
const PAGE_BUILD = process.env.EXPO_PUBLIC_TARGET === 'artifact';

export default ({ config }: ConfigContext): ExpoConfig => {
  let plugins: NonNullable<ExpoConfig['plugins']> = [...(config.plugins ?? [])];
  if (PAGE_BUILD) {
    // One bundle file: no lazily loaded route chunks, which a single page can't fetch.
    plugins = plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: false }] : p));
  }
  const android = { ...(config.android ?? {}) };

  if (HEALTH_ENABLED) {
    plugins.push(
      [
        '@kingstinct/react-native-healthkit',
        {
          NSHealthShareUsageDescription:
            'Steady Log can read sleep and workout sessions you choose to import into your private, on-device log.',
          NSHealthUpdateUsageDescription: false,
          background: false,
        },
      ],
      'react-native-health-connect',
      ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    );
    android.permissions = [
      ...(android.permissions ?? []),
      'android.permission.health.READ_SLEEP',
      'android.permission.health.READ_EXERCISE',
    ];
  }

  return {
    ...config,
    name: config.name ?? 'Steady Log',
    slug: config.slug ?? 'steady-log',
    android,
    plugins,
  };
};
