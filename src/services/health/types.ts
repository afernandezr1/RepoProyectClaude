import type { ImportedLog } from '../../domain/health';
import type { HealthDataType } from '../../domain/types';

export type PermissionOutcome =
  /** The platform confirmed access. */
  | 'granted'
  /** The prompt was shown; the platform does not reveal read access (HealthKit). */
  | 'requested'
  | 'denied'
  | 'unavailable';

export interface HealthAdapter {
  platformName: string;
  /** False unless the build opted in with EXPO_PUBLIC_HEALTH_ENABLED=true. */
  enabledInBuild: boolean;
  /** Native module present and the platform reports health data is available. */
  isAvailable(): Promise<boolean>;
  /** Ask for read access to exactly one data type. */
  requestPermission(type: HealthDataType): Promise<PermissionOutcome>;
  /** Read recent samples of one type, shaped as local logs. Throws on platform errors. */
  readRecent(type: HealthDataType, since: Date, until: Date): Promise<ImportedLog[]>;
  /** Where the user can review or revoke access. */
  manageAccessHint: string;
}

export const HEALTH_ENABLED_IN_BUILD = process.env.EXPO_PUBLIC_HEALTH_ENABLED === 'true';
