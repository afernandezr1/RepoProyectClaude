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
    out.push('Los días de descanso ayudan a recuperarse. Podrías añadir uno, pero tú decides.');
  }
  if (workout === 0) {
    out.push('No hay días de entrenamiento planificados. No pasa nada: puedes registrar lo que hagas igualmente.');
  }
  return out;
}

/** Soft note for very long templates; informational only. */
export function templateSuggestions(t: { exercises: Pick<Template['exercises'][number], 'targetSets'>[] }): string[] {
  const totalSets = t.exercises.reduce((a, e) => a + e.targetSets, 0);
  if (totalSets > 30) {
    return ['Esta plantilla tiene muchas series. Las sesiones más cortas también están perfectamente bien.'];
  }
  return [];
}

export interface SeedExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
}

export const BUILTIN_EXERCISES: SeedExercise[] = [
  { id: 'ex-squat', name: 'Sentadilla', kind: 'weight_reps' },
  { id: 'ex-bench', name: 'Press de banca', kind: 'weight_reps' },
  { id: 'ex-deadlift', name: 'Peso muerto', kind: 'weight_reps' },
  { id: 'ex-ohp', name: 'Press militar', kind: 'weight_reps' },
  { id: 'ex-row', name: 'Remo con barra', kind: 'weight_reps' },
  { id: 'ex-db-row', name: 'Remo con mancuerna', kind: 'weight_reps' },
  { id: 'ex-goblet', name: 'Sentadilla goblet', kind: 'weight_reps' },
  { id: 'ex-rdl', name: 'Peso muerto rumano', kind: 'weight_reps' },
  { id: 'ex-lunge', name: 'Zancada', kind: 'weight_reps' },
  { id: 'ex-latpull', name: 'Jalón al pecho', kind: 'weight_reps' },
  { id: 'ex-pullup', name: 'Dominada', kind: 'reps' },
  { id: 'ex-pushup', name: 'Flexión', kind: 'reps' },
  { id: 'ex-plank', name: 'Plancha', kind: 'duration' },
  { id: 'ex-walk', name: 'Caminar', kind: 'distance' },
  { id: 'ex-run', name: 'Correr', kind: 'distance' },
  { id: 'ex-cycle', name: 'Ciclismo', kind: 'distance' },
  { id: 'ex-stretch', name: 'Estiramientos', kind: 'duration' },
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
    name: 'Cuerpo completo A',
    notes: 'Una sesión equilibrada. Ajusta lo que quieras.',
    exercises: [
      { exerciseId: 'ex-goblet', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-pushup', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-db-row', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-plank', targetSets: 2, targetReps: null, restSeconds: 60 },
    ],
  },
  {
    id: 'tpl-full-b',
    name: 'Cuerpo completo B',
    notes: 'Altérnala con la A en los días de entrenamiento, si quieres.',
    exercises: [
      { exerciseId: 'ex-rdl', targetSets: 3, targetReps: 8, restSeconds: 120 },
      { exerciseId: 'ex-ohp', targetSets: 3, targetReps: 8, restSeconds: 120 },
      { exerciseId: 'ex-latpull', targetSets: 3, targetReps: 10, restSeconds: 90 },
      { exerciseId: 'ex-lunge', targetSets: 2, targetReps: 10, restSeconds: 90 },
    ],
  },
];
