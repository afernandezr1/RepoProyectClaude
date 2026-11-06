/**
 * Health Connect adapter (Android). Read-only, per data type, opt-in.
 *
 * Only active when the app was built with EXPO_PUBLIC_HEALTH_ENABLED=true
 * (which also adds the Health Connect config plugin, see app.config.ts). In
 * Expo Go, or if Health Connect isn't installed, calls degrade to "unavailable".
 */
import { sessionsToLogs, sleepSegmentsToLogs } from '../../domain/health';
import type { HealthDataType } from '../../domain/types';
import { HEALTH_ENABLED_IN_BUILD, type HealthAdapter } from './types';

type HC = typeof import('react-native-health-connect');

let cached: HC | null | undefined;
function lib(): HC | null {
  if (!HEALTH_ENABLED_IN_BUILD) return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('react-native-health-connect') as HC;
  } catch {
    cached = null;
  }
  return cached;
}

const SDK_AVAILABLE = 3;
const RECORD: Record<HealthDataType, 'SleepSession' | 'ExerciseSession'> = {
  sleep: 'SleepSession',
  workouts: 'ExerciseSession',
};

let initialized = false;
async function ready(hc: HC): Promise<boolean> {
  try {
    if ((await hc.getSdkStatus()) !== SDK_AVAILABLE) return false;
    if (!initialized) initialized = await hc.initialize();
    return initialized;
  } catch {
    return false;
  }
}

export const health: HealthAdapter = {
  platformName: 'Health Connect',
  enabledInBuild: HEALTH_ENABLED_IN_BUILD,

  async isAvailable() {
    const hc = lib();
    return hc ? ready(hc) : false;
  },

  async requestPermission(type) {
    const hc = lib();
    if (!hc || !(await ready(hc))) return 'unavailable';
    try {
      const recordType = RECORD[type];
      const granted = await hc.requestPermission([{ accessType: 'read', recordType }]);
      return granted.some((p) => p.accessType === 'read' && p.recordType === recordType) ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  },

  async readRecent(type, since, until) {
    const hc = lib();
    if (!hc || !(await ready(hc))) return [];
    const timeRangeFilter = { operator: 'between' as const, startTime: since.toISOString(), endTime: until.toISOString() };
    if (type === 'sleep') {
      const res = await hc.readRecords('SleepSession', { timeRangeFilter });
      return sleepSegmentsToLogs(
        res.records.map((r) => ({ start: new Date(r.startTime), end: new Date(r.endTime) })),
        'hc',
      );
    }
    const res = await hc.readRecords('ExerciseSession', { timeRangeFilter });
    return sessionsToLogs(
      res.records.map((r) => ({
        id: r.metadata?.id ?? `${r.startTime}-${r.endTime}`,
        title: r.title,
        start: new Date(r.startTime),
        end: new Date(r.endTime),
      })),
      'hc',
    );
  },

  manageAccessHint: 'Review or change access in Health Connect › App permissions › Steady Log.',
};

export * from './types';
