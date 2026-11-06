import type { DistanceUnit, DurationUnit, LogKind, ScaleUnit, Settings, WeightUnit } from './types';

export const KG_PER_LB = 0.45359237;
export const M_PER_MI = 1609.344;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function toMetres(value: number, unit: DistanceUnit): number {
  return unit === 'km' ? value * 1000 : value * M_PER_MI;
}

export function fromMetres(m: number, unit: DistanceUnit): number {
  return unit === 'km' ? m / 1000 : m / M_PER_MI;
}

export function toMinutes(value: number, unit: DurationUnit): number {
  return unit === 'min' ? value : value * 60;
}

export function fromMinutes(minutes: number, unit: DurationUnit): number {
  return unit === 'min' ? minutes : minutes / 60;
}

export function scaleMax(unit: ScaleUnit): number {
  return unit === 'of5' ? 5 : 10;
}

/** Rescale a value from one rating scale to another (1..max on both). */
export function rescale(value: number, from: ScaleUnit, to: ScaleUnit): number {
  if (from === to) return value;
  const a = scaleMax(from);
  const b = scaleMax(to);
  // Map 1..a onto 1..b linearly.
  return 1 + ((value - 1) * (b - 1)) / (a - 1);
}

export const DURATION_UNITS: DurationUnit[] = ['min', 'h'];
export const SCALE_UNITS: ScaleUnit[] = ['of5', 'of10'];

export function isDurationUnit(u: unknown): u is DurationUnit {
  return u === 'min' || u === 'h';
}

export function isScaleUnit(u: unknown): u is ScaleUnit {
  return u === 'of5' || u === 'of10';
}

/** The unit currently chosen by the user for a given log kind. */
export function preferredLogUnit(kind: LogKind, s: Settings): string | null {
  switch (kind) {
    case 'activity':
      return s.activityUnit;
    case 'sleep':
      return s.sleepUnit;
    case 'mood':
      return s.moodScale;
    case 'energy':
      return s.energyScale;
    default:
      return null;
  }
}

/**
 * Convert a stored log value (in whatever unit it was entered with) into the
 * unit the user currently prefers. Returns null when the value can't be
 * converted (e.g. corrupted unit) so callers can skip it rather than crash.
 */
export function convertLogValue(
  value: number,
  fromUnit: string | null,
  toUnit: string | null,
): number | null {
  if (fromUnit === toUnit) return value;
  if (isDurationUnit(fromUnit) && isDurationUnit(toUnit)) {
    return fromMinutes(toMinutes(value, fromUnit), toUnit);
  }
  if (isScaleUnit(fromUnit) && isScaleUnit(toUnit)) {
    return rescale(value, fromUnit, toUnit);
  }
  return null;
}

export function unitLabel(unit: string | null): string {
  switch (unit) {
    case 'min':
      return 'min';
    case 'h':
      return 'h';
    case 'of5':
      return '/ 5';
    case 'of10':
      return '/ 10';
    case 'kg':
      return 'kg';
    case 'lb':
      return 'lb';
    case 'km':
      return 'km';
    case 'mi':
      return 'mi';
    default:
      return '';
  }
}

/** Round for display without trailing zero noise: 12.50 -> "12.5", 3.0 -> "3". */
export function fmt(n: number, maxDecimals = 1): string {
  if (!Number.isFinite(n)) return '–';
  const p = 10 ** maxDecimals;
  return String(Math.round(n * p) / p);
}

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
