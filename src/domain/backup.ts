/**
 * Export / backup format. JSON is the complete, restorable backup; CSV files
 * are convenience exports for spreadsheets.
 */
import type {
  Exercise,
  LogEntry,
  Reminder,
  RoutineDay,
  Settings,
  Template,
  Workout,
  WorkoutSet,
} from './types';
import { DEFAULT_SETTINGS, LOG_KINDS } from './types';
import { BUILTIN_EXERCISES } from './routine';
import { fromKg, fromMetres } from './units';
import { err, ok, type Result } from './validation';

export const BACKUP_FORMAT = 'steady-log-backup';
export const BACKUP_VERSION = 1;
/** Refuse absurdly large imports instead of freezing the UI. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  exercises: Exercise[];
  templates: Template[];
  workouts: Workout[];
  sets: WorkoutSet[];
  logs: LogEntry[];
  routine: RoutineDay[];
  reminders: Reminder[];
}

export type BackupContent = Omit<BackupData, 'format' | 'version' | 'exportedAt'>;

export function buildBackup(content: BackupContent, now: Date): BackupData {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...content };
}

export function serializeBackup(b: BackupData): string {
  return JSON.stringify(b, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const isIso = (v: unknown) => isStr(v) && !Number.isNaN(new Date(v).getTime());

function checkArray<T>(
  data: Record<string, unknown>,
  key: string,
  check: (row: Record<string, unknown>) => boolean,
): Result<T[]> {
  const v = data[key];
  if (v === undefined) return ok([]);
  if (!Array.isArray(v)) return err(`"${key}" should be a list.`);
  for (let i = 0; i < v.length; i++) {
    const row = v[i];
    if (!isObj(row) || !check(row)) return err(`Item ${i + 1} in "${key}" is not in the expected format.`);
  }
  return ok(v as T[]);
}

/** Parse and validate a backup file. Never throws. */
export function parseBackup(text: string): Result<BackupData> {
  if (text.length > MAX_BACKUP_BYTES) return err('That file is too large to be a backup from this app.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("That file isn't valid JSON.");
  }
  if (!isObj(raw)) return err("That file isn't a backup from this app.");
  if (raw.format !== BACKUP_FORMAT) return err("That file isn't a backup from this app.");
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return err('This backup was made by a newer version of the app.');
  }

  const exercises = checkArray<Exercise>(raw, 'exercises', (r) => isStr(r.id) && isStr(r.name) && isStr(r.kind));
  if (!exercises.ok) return exercises;
  const templates = checkArray<Template>(
    raw,
    'templates',
    (r) =>
      isStr(r.id) &&
      isStr(r.name) &&
      Array.isArray(r.exercises) &&
      r.exercises.every((e: unknown) => isObj(e) && isStr(e.exerciseId) && typeof e.targetSets === 'number'),
  );
  if (!templates.ok) return templates;
  const workouts = checkArray<Workout>(
    raw,
    'workouts',
    (r) => isStr(r.id) && isStr(r.name) && isIso(r.startedAt) && (r.endedAt === null || isIso(r.endedAt)),
  );
  if (!workouts.ok) return workouts;
  const sets = checkArray<WorkoutSet>(
    raw,
    'sets',
    (r) =>
      isStr(r.id) &&
      isStr(r.workoutId) &&
      isStr(r.exerciseId) &&
      isNumOrNull(r.weightKg) &&
      isNumOrNull(r.reps) &&
      typeof r.completed === 'boolean',
  );
  if (!sets.ok) return sets;
  const logs = checkArray<LogEntry>(
    raw,
    'logs',
    (r) =>
      isStr(r.id) &&
      (LOG_KINDS as readonly unknown[]).includes(r.kind) &&
      isNumOrNull(r.value) &&
      isIso(r.loggedAt),
  );
  if (!logs.ok) return logs;
  const routine = checkArray<RoutineDay>(
    raw,
    'routine',
    (r) => typeof r.weekday === 'number' && r.weekday >= 0 && r.weekday <= 6 && isStr(r.kind),
  );
  if (!routine.ok) return routine;
  const reminders = checkArray<Reminder>(
    raw,
    'reminders',
    (r) => isStr(r.id) && typeof r.hour === 'number' && typeof r.minute === 'number' && Array.isArray(r.weekdays),
  );
  if (!reminders.ok) return reminders;

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(isObj(raw.settings) ? (raw.settings as Partial<Settings>) : {}),
  };
  settings.health = { ...DEFAULT_SETTINGS.health, ...(settings.health ?? {}) };

  // Referential checks: template rows must point at known exercises.
  const exerciseIds = new Set([...exercises.value.map((e) => e.id), ...BUILTIN_EXERCISES.map((e) => e.id)]);
  if (templates.value.some((t) => t.exercises.some((e) => !exerciseIds.has(e.exerciseId)))) {
    return err('Some templates refer to exercises that are not in the file.');
  }
  // Sets must point at known workouts.
  const workoutIds = new Set(workouts.value.map((w) => w.id));
  if (sets.value.some((s) => !workoutIds.has(s.workoutId))) {
    return err('Some sets refer to workouts that are not in the file.');
  }

  return ok({
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : new Date(0).toISOString(),
    settings,
    exercises: exercises.value,
    templates: templates.value,
    workouts: workouts.value,
    sets: sets.value,
    logs: logs.value,
    routine: routine.value,
    reminders: reminders.value,
  });
}

/** RFC 4180 escaping plus protection against spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function setsToCsv(b: Pick<BackupData, 'workouts' | 'sets' | 'exercises' | 'settings'>): string {
  const workouts = new Map(b.workouts.map((w) => [w.id, w]));
  const names = new Map(b.exercises.map((e) => [e.id, e.name]));
  const { weightUnit, distanceUnit } = b.settings;
  const rows = b.sets
    .filter((s) => s.completed)
    .map((s) => {
      const w = workouts.get(s.workoutId);
      return [
        w?.startedAt ?? '',
        w?.name ?? '',
        names.get(s.exerciseId) ?? s.exerciseId,
        s.setIndex + 1,
        s.weightKg != null ? round(fromKg(s.weightKg, weightUnit)) : '',
        s.reps ?? '',
        s.durationSeconds ?? '',
        s.distanceM != null ? round(fromMetres(s.distanceM, distanceUnit)) : '',
      ];
    });
  return toCsv(
    ['workout_started_at', 'workout_name', 'exercise', 'set', `weight_${weightUnit}`, 'reps', 'duration_s', `distance_${distanceUnit}`],
    rows,
  );
}

export function logsToCsv(b: Pick<BackupData, 'logs'>): string {
  return toCsv(
    ['logged_at', 'kind', 'value', 'unit', 'text', 'source'],
    b.logs.map((l) => [l.loggedAt, l.kind, l.value ?? '', l.unit ?? '', l.text, l.source]),
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
