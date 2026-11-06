/**
 * Trends: turn raw local history into weekly patterns.
 *
 * Design rules (deliberate):
 *  - Describe, don't judge. No "missed", "failed", "behind", streak-loss or
 *    body-related language. Rest days are counted as part of the plan.
 *  - No targets are enforced; planned days are shown only for context.
 *  - Pure function: no I/O, no clock reads (pass `now`).
 */
import { addDays, dayKey, minutesBetween, mondayWeekday, shortDate, startOfWeek } from './dates';
import type {
  Exercise,
  LogEntry,
  RoutineDay,
  Settings,
  Weekday,
  Workout,
  WorkoutSet,
} from './types';
import { convertLogValue, fmt, fromKg, preferredLogUnit, unitLabel } from './units';

export interface TrendInput {
  workouts: Workout[];
  sets: WorkoutSet[];
  logs: LogEntry[];
  routine: RoutineDay[];
  exercises: Exercise[];
  settings: Settings;
  now: Date;
  /** How many weeks to include, ending with the current week. */
  weeks: number;
}

export interface WeekSummary {
  weekStart: string;
  label: string;
  sessions: number;
  activeDays: number;
  completedSets: number;
  /** Sum of weight x reps in the user's weight unit. */
  volume: number;
  trainingMinutes: number;
  /** In the user's activity unit. */
  activityTotal: number;
  /** Averages in the user's preferred unit, null when nothing was logged. */
  sleepAverage: number | null;
  moodAverage: number | null;
  energyAverage: number | null;
  noteCount: number;
}

export interface ExerciseTrendPoint {
  weekStart: string;
  /** Heaviest completed set, user's weight unit. Null if no weighted sets. */
  topWeight: number | null;
  totalReps: number;
  sets: number;
}

export interface ExerciseTrend {
  exerciseId: string;
  name: string;
  points: ExerciseTrendPoint[];
}

export interface TrendsResult {
  weeks: WeekSummary[];
  weekdayPattern: { weekday: Weekday; sessions: number }[];
  plannedWorkoutDays: number;
  plannedRestDays: number;
  consistency: {
    weeksWithActivity: number;
    totalWeeks: number;
    averageActiveDays: number;
  };
  exerciseTrends: ExerciseTrend[];
  /** Neutral, human-readable observations. */
  observations: string[];
  isEmpty: boolean;
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function weekIndexFor(date: Date, firstWeekStart: Date, weeks: number): number {
  const ws = startOfWeek(date);
  const diffDays = Math.round((ws.getTime() - firstWeekStart.getTime()) / 86_400_000);
  const idx = Math.floor(diffDays / 7);
  return idx >= 0 && idx < weeks ? idx : -1;
}

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeTrends(input: TrendInput): TrendsResult {
  const weeks = Math.max(1, Math.min(52, Math.floor(input.weeks)));
  const { settings } = input;
  const currentWeekStart = startOfWeek(input.now);
  const firstWeekStart = addDays(currentWeekStart, -7 * (weeks - 1));

  const summaries: WeekSummary[] = [];
  const activeDaySets: Set<string>[] = [];
  const sleepVals: number[][] = [];
  const moodVals: number[][] = [];
  const energyVals: number[][] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(firstWeekStart, i * 7);
    summaries.push({
      weekStart: dayKey(ws),
      label: shortDate(ws),
      sessions: 0,
      activeDays: 0,
      completedSets: 0,
      volume: 0,
      trainingMinutes: 0,
      activityTotal: 0,
      sleepAverage: null,
      moodAverage: null,
      energyAverage: null,
      noteCount: 0,
    });
    activeDaySets.push(new Set());
    sleepVals.push([]);
    moodVals.push([]);
    energyVals.push([]);
  }

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const finishedWorkouts = new Map<string, { week: number }>();

  for (const w of input.workouts) {
    if (!w.endedAt) continue; // in-progress workouts aren't history yet
    const d = parse(w.startedAt);
    if (!d) continue;
    const idx = weekIndexFor(d, firstWeekStart, weeks);
    if (idx < 0) continue;
    finishedWorkouts.set(w.id, { week: idx });
    summaries[idx].sessions += 1;
    summaries[idx].trainingMinutes += minutesBetween(w.startedAt, w.endedAt);
    activeDaySets[idx].add(dayKey(d));
    weekdayCounts[mondayWeekday(d)] += 1;
  }

  const exerciseNames = new Map(input.exercises.map((e) => [e.id, e.name]));
  const perExercise = new Map<string, ExerciseTrendPoint[]>();

  for (const s of input.sets) {
    if (!s.completed) continue;
    const fw = finishedWorkouts.get(s.workoutId);
    if (!fw) continue;
    const sum = summaries[fw.week];
    sum.completedSets += 1;
    const weight = s.weightKg != null ? fromKg(s.weightKg, settings.weightUnit) : null;
    if (weight != null && s.reps != null) sum.volume += weight * s.reps;

    let points = perExercise.get(s.exerciseId);
    if (!points) {
      points = summaries.map((x) => ({ weekStart: x.weekStart, topWeight: null, totalReps: 0, sets: 0 }));
      perExercise.set(s.exerciseId, points);
    }
    const p = points[fw.week];
    p.sets += 1;
    p.totalReps += s.reps ?? 0;
    if (weight != null && (p.topWeight == null || weight > p.topWeight)) p.topWeight = weight;
  }

  for (const log of input.logs) {
    const d = parse(log.loggedAt);
    if (!d) continue;
    const idx = weekIndexFor(d, firstWeekStart, weeks);
    if (idx < 0) continue;
    if (log.kind === 'note') {
      summaries[idx].noteCount += 1;
      continue;
    }
    if (log.value == null) continue;
    const target = preferredLogUnit(log.kind, settings);
    const v = convertLogValue(log.value, log.unit, target);
    if (v == null) continue; // unknown unit: skip instead of guessing
    if (log.kind === 'activity') {
      summaries[idx].activityTotal += v;
      activeDaySets[idx].add(dayKey(d));
    } else if (log.kind === 'sleep') sleepVals[idx].push(v);
    else if (log.kind === 'mood') moodVals[idx].push(v);
    else if (log.kind === 'energy') energyVals[idx].push(v);
  }

  summaries.forEach((s, i) => {
    s.activeDays = activeDaySets[i].size;
    s.sleepAverage = avg(sleepVals[i]);
    s.moodAverage = avg(moodVals[i]);
    s.energyAverage = avg(energyVals[i]);
  });

  const plannedWorkoutDays = input.routine.filter((r) => r.kind === 'workout').length;
  const plannedRestDays = input.routine.filter((r) => r.kind === 'rest').length;
  const weeksWithActivity = summaries.filter((s) => s.activeDays > 0).length;
  const averageActiveDays = summaries.reduce((a, s) => a + s.activeDays, 0) / weeks;

  const exerciseTrends: ExerciseTrend[] = Array.from(perExercise.entries())
    .map(([exerciseId, points]) => ({
      exerciseId,
      name: exerciseNames.get(exerciseId) ?? 'Exercise',
      points,
    }))
    .sort((a, b) => sumSets(b) - sumSets(a));

  const isEmpty =
    summaries.every(
      (s) =>
        s.sessions === 0 &&
        s.activityTotal === 0 &&
        s.sleepAverage == null &&
        s.moodAverage == null &&
        s.energyAverage == null &&
        s.noteCount === 0,
    );

  const result: TrendsResult = {
    weeks: summaries,
    weekdayPattern: weekdayCounts.map((sessions, weekday) => ({ weekday: weekday as Weekday, sessions })),
    plannedWorkoutDays,
    plannedRestDays,
    consistency: { weeksWithActivity, totalWeeks: weeks, averageActiveDays },
    exerciseTrends,
    observations: [],
    isEmpty,
  };
  result.observations = describe(result, settings);
  return result;
}

function sumSets(t: ExerciseTrend): number {
  return t.points.reduce((a, p) => a + p.sets, 0);
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Neutral observations. Never comparative to other people, never about the body. */
export function describe(t: TrendsResult, settings: Settings): string[] {
  if (t.isEmpty) return [];
  const out: string[] = [];
  const thisWeek = t.weeks[t.weeks.length - 1];

  out.push(
    `This week: ${plural(thisWeek.sessions, 'session')} and ${plural(thisWeek.activeDays, 'active day')} so far.`,
  );
  if (t.plannedWorkoutDays > 0 || t.plannedRestDays > 0) {
    out.push(
      `Your routine has ${plural(t.plannedWorkoutDays, 'workout day')} and ${plural(t.plannedRestDays, 'rest day')}. Rest days are part of the plan.`,
    );
  }
  out.push(
    `You were active in ${t.consistency.weeksWithActivity} of the last ${plural(t.consistency.totalWeeks, 'week')}, about ${fmt(t.consistency.averageActiveDays)} active days per week on average.`,
  );

  const maxCount = Math.max(...t.weekdayPattern.map((p) => p.sessions));
  if (maxCount > 0) {
    const days = t.weekdayPattern.filter((p) => p.sessions === maxCount).map((p) => WEEKDAY_NAMES[p.weekday]);
    out.push(`Sessions most often land on ${days.join(' and ')}.`);
  }

  const sleeps = t.weeks.map((w) => w.sleepAverage).filter((v): v is number => v != null);
  if (sleeps.length > 0) {
    const a = sleeps.reduce((x, y) => x + y, 0) / sleeps.length;
    out.push(`Logged sleep averaged ${fmt(a)} ${unitLabel(settings.sleepUnit)} per entry.`);
  }
  const moods = t.weeks.map((w) => w.moodAverage).filter((v): v is number => v != null);
  if (moods.length > 0) {
    const a = moods.reduce((x, y) => x + y, 0) / moods.length;
    out.push(`Logged mood averaged ${fmt(a)} ${unitLabel(settings.moodScale)}.`);
  }
  const energies = t.weeks.map((w) => w.energyAverage).filter((v): v is number => v != null);
  if (energies.length > 0) {
    const a = energies.reduce((x, y) => x + y, 0) / energies.length;
    out.push(`Logged energy averaged ${fmt(a)} ${unitLabel(settings.energyScale)}.`);
  }
  return out;
}

/** Words we never want to show in trend copy. Used by tests as a guard rail. */
export const DISALLOWED_TREND_WORDS = [
  'missed',
  'failed',
  'fail',
  'lazy',
  'behind',
  'should',
  'must',
  'fat',
  'skinny',
  'calories',
  'weight loss',
  'streak lost',
  'diagnos',
  'bmi',
];

export function hasDisallowedLanguage(lines: string[]): string | null {
  const text = lines.join(' ').toLowerCase();
  for (const w of DISALLOWED_TREND_WORDS) {
    const re = new RegExp(`\\b${w}`, 'i');
    if (re.test(text)) return w;
  }
  return null;
}
