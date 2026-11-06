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

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [...(config.plugins ?? [])];
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
