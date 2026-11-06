/**
 * Apple Health (HealthKit) adapter. Read-only, per data type, opt-in.
 *
 * Only active when the app was built with EXPO_PUBLIC_HEALTH_ENABLED=true
 * (which also adds the HealthKit config plugin, see app.config.ts). In Expo Go
 * or a build without the native module, every call degrades to "unavailable".
 */
import { sessionsToLogs, sleepSegmentsToLogs } from '../../domain/health';
import type { HealthDataType } from '../../domain/types';
import { HEALTH_ENABLED_IN_BUILD, type HealthAdapter } from './types';

type HK = typeof import('@kingstinct/react-native-healthkit');

let cached: HK | null | undefined;
function lib(): HK | null {
  if (!HEALTH_ENABLED_IN_BUILD) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    cached = null; // native module missing (e.g. Expo Go)
  }
  return cached;
}

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const WORKOUT = 'HKWorkoutTypeIdentifier' as const;

// HKCategoryValueSleepAnalysis: 0 inBed, 1 asleep(Unspecified), 2 awake, 3 core, 4 deep, 5 REM
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

export const health: HealthAdapter = {
  platformName: 'Apple Health',
  enabledInBuild: HEALTH_ENABLED_IN_BUILD,

  async isAvailable() {
    const hk = lib();
    if (!hk) return false;
    try {
      return hk.isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async requestPermission(type: HealthDataType) {
    const hk = lib();
    if (!hk) return 'unavailable';
    try {
      const toRead = type === 'sleep' ? [SLEEP] : [WORKOUT];
      const shown = await hk.requestAuthorization({ toRead });
      // HealthKit never discloses whether *read* access was granted.
      return shown ? 'requested' : 'denied';
    } catch {
      return 'denied';
    }
  },

  async readRecent(type, since, until) {
    const hk = lib();
    if (!hk) return [];
    const filter = { date: { startDate: since, endDate: until } };
    if (type === 'sleep') {
      const samples = await hk.queryCategorySamples(SLEEP, { limit: 0, filter });
      return sleepSegmentsToLogs(
        samples
          .filter((s) => ASLEEP_VALUES.has(Number(s.value)))
          .map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate) })),
        'hk',
      );
    }
    const workouts = await hk.queryWorkoutSamples({ limit: 0, filter });
    return sessionsToLogs(
      workouts.map((w) => ({ id: w.uuid, start: new Date(w.startDate), end: new Date(w.endDate) })),
      'hk',
    );
  },

  manageAccessHint: 'Review or change access in the Health app: Profile › Apps › Steady Log.',
};

export * from './types';
