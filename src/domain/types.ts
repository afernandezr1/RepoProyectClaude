/**
 * Core data types. Everything here is plain data so it can be stored in SQLite,
 * exported to JSON, and tested without React Native.
 *
 * Canonical storage units:
 *  - set weight: kilograms (converted for display using the user's unit setting)
 *  - set distance: metres
 *  - durations: seconds for sets/rest, minutes for activity/sleep logs
 * Log entries keep the unit they were entered in so nothing is silently rounded.
 */

export type ExerciseKind = 'weight_reps' | 'reps' | 'duration' | 'distance';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  builtin: boolean;
  createdAt: string;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  targetReps: number | null;
  restSeconds: number;
}

export interface Template {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  exercises: TemplateExercise[];
}

export interface Workout {
  id: string;
  templateId: string | null;
  name: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  setIndex: number;
  /** kilograms */
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  /** metres */
  distanceM: number | null;
  restSeconds: number;
  completed: boolean;
  completedAt: string | null;
}

export type LogKind = 'activity' | 'sleep' | 'mood' | 'energy' | 'note';

export const LOG_KINDS: readonly LogKind[] = ['activity', 'sleep', 'mood', 'energy', 'note'];

export interface LogEntry {
  id: string;
  kind: LogKind;
  /** Null for plain notes. */
  value: number | null;
  /** Unit the value was entered in, e.g. 'min', 'h', 'of5', 'of10'. */
  unit: string | null;
  text: string;
  loggedAt: string;
  source: 'manual' | 'health';
}

export type DayPlanKind = 'workout' | 'rest' | 'open';

/** 0 = Monday ... 6 = Sunday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RoutineDay {
  weekday: Weekday;
  kind: DayPlanKind;
  templateId: string | null;
  note: string;
}

export interface Reminder {
  id: string;
  label: string;
  hour: number;
  minute: number;
  /** Weekdays 0 (Mon) .. 6 (Sun) */
  weekdays: Weekday[];
  enabled: boolean;
}

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';
export type DurationUnit = 'min' | 'h';
export type ScaleUnit = 'of5' | 'of10';

/** Health-platform data types the user can opt into, one permission each (read-only). */
export type HealthDataType = 'sleep' | 'workouts';

export const HEALTH_DATA_TYPES: readonly HealthDataType[] = ['sleep', 'workouts'];

export interface Settings {
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  activityUnit: DurationUnit;
  sleepUnit: DurationUnit;
  moodScale: ScaleUnit;
  energyScale: ScaleUnit;
  remindersMuted: boolean;
  defaultRestSeconds: number;
  /** Per-type opt-in. All false by default. */
  health: Record<HealthDataType, boolean>;
  disclaimerAcknowledged: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  distanceUnit: 'km',
  activityUnit: 'min',
  sleepUnit: 'h',
  moodScale: 'of5',
  energyScale: 'of5',
  remindersMuted: false,
  defaultRestSeconds: 90,
  health: { sleep: false, workouts: false },
  disclaimerAcknowledged: false,
};
