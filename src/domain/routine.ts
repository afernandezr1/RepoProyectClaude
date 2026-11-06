import type { ExerciseKind, RoutineDay, Template, Weekday } from './types';

/** A moderate default week: three training days, rest days in between, one open day. */
export function defaultRoutine(): RoutineDay[] {
  const kinds: RoutineDay['kind'][] = ['workout', 'rest', 'workout', 'rest', 'workout', 'open', 'rest'];
  return kinds.map((kind, i) => ({ weekday: i as Weekday, kind, templateId: null, note: '' }));
}

/**
 * Gentle, optional suggestions. Never blocks saving and never uses pressure.
 */
export function routineSuggestions(routine: RoutineDay[]): string[] {
  const out: string[] = [];
  const workout = routine.filter((d) => d.kind === 'workout').length;
  const rest = routine.filter((d) => d.kind === 'rest').length;
  if (rest === 0) {
    out.push('Rest days help recovery. You might add one, but the choice is yours.');
  }
  if (workout === 0) {
    out.push('No workout days planned. That is fine — you can still log anything you do.');
  }
  return out;
}

/** Soft note for very long templates; informational only. */
export function templateSuggestions(t: { exercises: Pick<Template['exercises'][number], 'targetSets'>[] }): string[] {
  const totalSets = t.exercises.reduce((a, e) => a + e.targetSets, 0);
  if (totalSets > 30) {
    return ['This template has a lot of sets. Shorter sessions are perfectly fine too.'];
  }
  return [];
}

export interface SeedExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
}

export const BUILTIN_EXERCISES: SeedExercise[] = [
  { id: 'ex-squat', name: 'Squat', kind: 'weight_reps' },
  { id: 'ex-bench', name: 'Bench Press', kind: 'weight_reps' },
  { id: 'ex-deadlift', name: 'Deadlift', kind: 'weight_reps' },
  { id: 'ex-ohp', name: 'Overhead Press', kind: 'weight_reps' },
  { id: 'ex-row', name: 'Barbell Row', kind: 'weight_reps' },
  { id: 'ex-db-row', name: 'Dumbbell Row', kind: 'weight_reps' },
  { id: 'ex-goblet', name: 'Goblet Squat', kind: 'weight_reps' },
  { id: 'ex-rdl', name: 'Romanian Deadlift', kind: 'weight_reps' },
  { id: 'ex-lunge', name: 'Lunge', kind: 'weight_reps' },
  { id: 'ex-latpull', name: 'Lat Pulldown', kind: 'weight_reps' },
  { id: 'ex-pullup', name: 'Pull-up', kind: 'reps' },
  { id: 'ex-pushup', name: 'Push-up', kind: 'reps' },
  { id: 'ex-plank', name: 'Plank', kind: 'duration' },
  { id: 'ex-walk', name: 'Walk', kind: 'distance' },
  { id: 'ex-run', name: 'Run', kind: 'distance' },
  { id: 'ex-cycle', name: 'Cycling', kind: 'distance' },
  { id: 'ex-stretch', name: 'Stretching', kind: 'duration' },
];

/** Starter templates: moderate volume, generous rest. */
export const STARTER_TEMPLATES: {
  id: string;
  name: string;
  notes: string;
  exercises: { exerciseId: string; targetSets: number; targetReps: number | null; restSeconds: number }[];
}[] = [
  {
    id: 'tpl-full-a',
    name: 'Full Body A',
    notes: 'A balanced session. Adjust anything to suit you.',
    exercises: [
      { exerciseId: 'ex-goblet', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-pushup', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-db-row', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-plank', targetSets: 2, targetReps: null, restSeconds: 60 },
    ],
  },
  {
    id: 'tpl-full-b',
    name: 'Full Body B',
    notes: 'Alternate with A on training days if you like.',
    exercises: [
      { exerciseId: 'ex-rdl', targetSets: 3, targetReps: 8, restSeconds: 120 },
      { exerciseId: 'ex-ohp', targetSets: 3, targetReps: 8, restSeconds: 120 },
      { exerciseId: 'ex-latpull', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-lunge', targetSets: 2, targetReps: 10, restSeconds: 90 },
    ],
  },
];
