import type { DurationUnit, LogKind, ScaleUnit, Weekday } from './types';
import { isDurationUnit, isScaleUnit, scaleMax, toMinutes } from './units';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: string): Result<T> => ({ ok: false, error });

export const LIMITS = {
  nameMax: 80,
  textMax: 2000,
  weightKgMax: 1000,
  repsMax: 1000,
  setDurationSecondsMax: 24 * 3600,
  distanceMMax: 1_000_000,
  restSecondsMax: 60 * 60,
  targetSetsMax: 20,
  /** A single activity or sleep entry is capped at 24h. */
  logMinutesMax: 24 * 60,
} as const;

/**
 * Parse a user-typed number. Accepts "12", "12.5", "12,5", surrounding spaces.
 * Empty input returns null (meaning "not provided"), garbage returns NaN.
 */
export function parseNumberInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function optionalNumber(
  raw: string | null | undefined,
  label: string,
  { min, max, integer }: { min: number; max: number; integer?: boolean },
): Result<number | null> {
  const n = parseNumberInput(raw);
  if (n === null) return ok(null);
  if (Number.isNaN(n)) return err(`${label} must be a number.`);
  if (integer && !Number.isInteger(n)) return err(`${label} must be a whole number.`);
  if (n < min || n > max) return err(`${label} must be between ${min} and ${max}.`);
  return ok(n);
}

export function validateName(raw: string, label = 'Name'): Result<string> {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (t.length === 0) return err(`${label} can't be empty.`);
  if (t.length > LIMITS.nameMax) return err(`${label} must be ${LIMITS.nameMax} characters or fewer.`);
  return ok(t);
}

export function validateText(raw: string, label = 'Text'): Result<string> {
  const t = raw.trim();
  if (t.length > LIMITS.textMax) return err(`${label} must be ${LIMITS.textMax} characters or fewer.`);
  return ok(t);
}

export interface SetInput {
  weight: string;
  reps: string;
  duration: string;
  distance: string;
}

export interface ParsedSet {
  /** In the user's display unit; conversion to kg happens at the edge. */
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  /** In the user's display distance unit. */
  distance: number | null;
}

/** Validate a set row. At least one measure must be present to mark it done. */
export function validateSet(input: SetInput, requireValue: boolean): Result<ParsedSet> {
  const weight = optionalNumber(input.weight, 'Weight', { min: 0, max: LIMITS.weightKgMax * 2.3 });
  if (!weight.ok) return weight;
  const reps = optionalNumber(input.reps, 'Reps', { min: 0, max: LIMITS.repsMax, integer: true });
  if (!reps.ok) return reps;
  const duration = optionalNumber(input.duration, 'Duration', {
    min: 0,
    max: LIMITS.setDurationSecondsMax,
    integer: true,
  });
  if (!duration.ok) return duration;
  const distance = optionalNumber(input.distance, 'Distance', { min: 0, max: 1000 });
  if (!distance.ok) return distance;
  const v: ParsedSet = {
    weight: weight.value,
    reps: reps.value,
    durationSeconds: duration.value,
    distance: distance.value,
  };
  if (requireValue && v.weight === null && v.reps === null && v.durationSeconds === null && v.distance === null) {
    return err('Enter at least one value (reps, weight, time or distance) before completing the set.');
  }
  return ok(v);
}

export interface TemplateExerciseInput {
  targetSets: string;
  targetReps: string;
  restSeconds: string;
}

export function validateTemplateExercise(
  input: TemplateExerciseInput,
): Result<{ targetSets: number; targetReps: number | null; restSeconds: number }> {
  const sets = optionalNumber(input.targetSets, 'Sets', { min: 1, max: LIMITS.targetSetsMax, integer: true });
  if (!sets.ok) return sets;
  const reps = optionalNumber(input.targetReps, 'Reps', { min: 1, max: LIMITS.repsMax, integer: true });
  if (!reps.ok) return reps;
  const rest = optionalNumber(input.restSeconds, 'Rest', { min: 0, max: LIMITS.restSecondsMax, integer: true });
  if (!rest.ok) return rest;
  return ok({ targetSets: sets.value ?? 3, targetReps: reps.value, restSeconds: rest.value ?? 90 });
}

export interface LogInput {
  kind: LogKind;
  value: string;
  unit: string | null;
  text: string;
}

export function validateLog(input: LogInput): Result<{ value: number | null; unit: string | null; text: string }> {
  const text = validateText(input.text, 'Note');
  if (!text.ok) return text;
  if (input.kind === 'note') {
    if (text.value.length === 0) return err('Write something for the note.');
    return ok({ value: null, unit: null, text: text.value });
  }
  const n = parseNumberInput(input.value);
  if (input.kind === 'activity' || input.kind === 'sleep') {
    if (!isDurationUnit(input.unit)) return err('Choose a unit (minutes or hours).');
    const unit: DurationUnit = input.unit;
    if (n === null) return err('Enter a duration.');
    if (Number.isNaN(n)) return err('Duration must be a number.');
    if (n <= 0) return err('Duration must be more than zero.');
    if (toMinutes(n, unit) > LIMITS.logMinutesMax) return err('A single entry can be at most 24 hours.');
    return ok({ value: n, unit, text: text.value });
  }
  // mood / energy
  if (!isScaleUnit(input.unit)) return err('Choose a scale.');
  const unit: ScaleUnit = input.unit;
  if (n === null) return err('Pick a value.');
  if (Number.isNaN(n)) return err('Value must be a number.');
  const max = scaleMax(unit);
  if (!Number.isInteger(n) || n < 1 || n > max) return err(`Pick a whole number from 1 to ${max}.`);
  return ok({ value: n, unit, text: text.value });
}

export function validateReminder(input: {
  label: string;
  time: string;
  weekdays: Weekday[];
}): Result<{ label: string; hour: number; minute: number; weekdays: Weekday[] }> {
  const label = validateName(input.label, 'Label');
  if (!label.ok) return label;
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
  if (!m) return err('Use 24-hour time like 07:30.');
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return err('Use 24-hour time like 07:30.');
  const days = Array.from(new Set(input.weekdays)).sort() as Weekday[];
  if (days.length === 0) return err('Pick at least one day.');
  return ok({ label: label.value, hour, minute, weekdays: days });
}
