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
  if (Number.isNaN(n)) return err(`${label}: tiene que ser un número.`);
  if (integer && !Number.isInteger(n)) return err(`${label}: tiene que ser un número entero.`);
  if (n < min || n > max) return err(`${label}: tiene que estar entre ${min} y ${max}.`);
  return ok(n);
}

export function validateName(raw: string, label = 'Nombre'): Result<string> {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (t.length === 0) return err(`${label}: no puede estar vacío.`);
  if (t.length > LIMITS.nameMax) return err(`${label}: máximo ${LIMITS.nameMax} caracteres.`);
  return ok(t);
}

export function validateText(raw: string, label = 'Texto'): Result<string> {
  const t = raw.trim();
  if (t.length > LIMITS.textMax) return err(`${label}: máximo ${LIMITS.textMax} caracteres.`);
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
  const weight = optionalNumber(input.weight, 'Peso', { min: 0, max: LIMITS.weightKgMax * 2.3 });
  if (!weight.ok) return weight;
  const reps = optionalNumber(input.reps, 'Repeticiones', { min: 0, max: LIMITS.repsMax, integer: true });
  if (!reps.ok) return reps;
  const duration = optionalNumber(input.duration, 'Duración', {
    min: 0,
    max: LIMITS.setDurationSecondsMax,
    integer: true,
  });
  if (!duration.ok) return duration;
  const distance = optionalNumber(input.distance, 'Distancia', { min: 0, max: 1000 });
  if (!distance.ok) return distance;
  const v: ParsedSet = {
    weight: weight.value,
    reps: reps.value,
    durationSeconds: duration.value,
    distance: distance.value,
  };
  if (requireValue && v.weight === null && v.reps === null && v.durationSeconds === null && v.distance === null) {
    return err('Escribe al menos un valor (repeticiones, peso, tiempo o distancia) antes de completar la serie.');
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
  const sets = optionalNumber(input.targetSets, 'Series', { min: 1, max: LIMITS.targetSetsMax, integer: true });
  if (!sets.ok) return sets;
  const reps = optionalNumber(input.targetReps, 'Repeticiones', { min: 1, max: LIMITS.repsMax, integer: true });
  if (!reps.ok) return reps;
  const rest = optionalNumber(input.restSeconds, 'Descanso', { min: 0, max: LIMITS.restSecondsMax, integer: true });
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
  const text = validateText(input.text, 'Nota');
  if (!text.ok) return text;
  if (input.kind === 'note') {
    if (text.value.length === 0) return err('Escribe algo en la nota.');
    return ok({ value: null, unit: null, text: text.value });
  }
  const n = parseNumberInput(input.value);
  if (input.kind === 'activity' || input.kind === 'sleep') {
    if (!isDurationUnit(input.unit)) return err('Elige una unidad (minutos u horas).');
    const unit: DurationUnit = input.unit;
    if (n === null) return err('Escribe una duración.');
    if (Number.isNaN(n)) return err('La duración tiene que ser un número.');
    if (n <= 0) return err('La duración tiene que ser mayor que cero.');
    if (toMinutes(n, unit) > LIMITS.logMinutesMax) return err('Una entrada puede durar como máximo 24 horas.');
    return ok({ value: n, unit, text: text.value });
  }
  // mood / energy
  if (!isScaleUnit(input.unit)) return err('Elige una escala.');
  const unit: ScaleUnit = input.unit;
  if (n === null) return err('Elige un valor.');
  if (Number.isNaN(n)) return err('El valor tiene que ser un número.');
  const max = scaleMax(unit);
  if (!Number.isInteger(n) || n < 1 || n > max) return err(`Elige un número entero del 1 al ${max}.`);
  return ok({ value: n, unit, text: text.value });
}

export function validateReminder(input: {
  label: string;
  time: string;
  weekdays: Weekday[];
}): Result<{ label: string; hour: number; minute: number; weekdays: Weekday[] }> {
  const label = validateName(input.label, 'Nombre');
  if (!label.ok) return label;
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.time.trim());
  if (!m) return err('Usa el formato de 24 horas, por ejemplo 07:30.');
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return err('Usa el formato de 24 horas, por ejemplo 07:30.');
  const days = Array.from(new Set(input.weekdays)).sort() as Weekday[];
  if (days.length === 0) return err('Elige al menos un día.');
  return ok({ label: label.value, hour, minute, weekdays: days });
}
