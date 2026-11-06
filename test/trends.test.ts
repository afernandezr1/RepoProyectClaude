import { computeTrends, hasDisallowedLanguage } from '../src/domain/trends';
import { defaultRoutine } from '../src/domain/routine';
import { DEFAULT_SETTINGS, type LogEntry, type Settings, type Workout, type WorkoutSet } from '../src/domain/types';

// Thursday 13 Nov 2025 (TZ is pinned to UTC in test/setupTz.js)
const NOW = new Date('2025-11-13T18:00:00Z');

const settings = (patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  health: { ...DEFAULT_SETTINGS.health },
  ...patch,
});

function workout(id: string, start: string, minutes: number | null): Workout {
  const end = minutes == null ? null : new Date(new Date(start).getTime() + minutes * 60000).toISOString();
  return { id, templateId: null, name: 'W', startedAt: start, endedAt: end, notes: '' };
}

function set(workoutId: string, exerciseId: string, weightKg: number | null, reps: number | null, completed = true): WorkoutSet {
  return {
    id: `${workoutId}-${exerciseId}-${Math.random()}`,
    workoutId,
    exerciseId,
    position: 0,
    setIndex: 0,
    weightKg,
    reps,
    durationSeconds: null,
    distanceM: null,
    restSeconds: 90,
    completed,
    completedAt: completed ? '2025-11-10T10:00:00Z' : null,
  };
}

function log(kind: LogEntry['kind'], value: number | null, unit: string | null, at: string): LogEntry {
  return { id: `${kind}-${at}`, kind, value, unit, text: '', loggedAt: at, source: 'manual' };
}

const exercises = [
  { id: 'ex-squat', name: 'Squat', kind: 'weight_reps' as const, builtin: true, createdAt: '' },
  { id: 'ex-pushup', name: 'Push-up', kind: 'reps' as const, builtin: true, createdAt: '' },
];

describe('computeTrends', () => {
  it('returns an empty result with no observations when there is no data', () => {
    const t = computeTrends({
      workouts: [],
      sets: [],
      logs: [],
      routine: defaultRoutine(),
      exercises,
      settings: settings(),
      now: NOW,
      weeks: 4,
    });
    expect(t.isEmpty).toBe(true);
    expect(t.observations).toEqual([]);
    expect(t.weeks).toHaveLength(4);
    expect(t.weeks[3].weekStart).toBe('2025-11-10'); // Monday of the current week
    expect(t.weeks[0].weekStart).toBe('2025-10-20');
  });

  it('buckets finished workouts by Monday-based week and ignores in-progress ones', () => {
    const workouts = [
      workout('a', '2025-11-10T08:00:00Z', 45), // Mon this week
      workout('b', '2025-11-12T08:00:00Z', 30), // Wed this week
      workout('c', '2025-11-09T08:00:00Z', 60), // Sun last week
      workout('d', '2025-11-13T08:00:00Z', null), // in progress
      workout('old', '2025-01-01T08:00:00Z', 60), // outside the window
    ];
    const sets = [
      set('a', 'ex-squat', 60, 5),
      set('a', 'ex-squat', 62.5, 5),
      set('a', 'ex-squat', 80, 5, false), // not completed -> ignored
      set('b', 'ex-pushup', null, 12),
      set('c', 'ex-squat', 55, 8),
      set('d', 'ex-squat', 100, 1), // in-progress workout -> ignored
    ];
    const t = computeTrends({ workouts, sets, logs: [], routine: defaultRoutine(), exercises, settings: settings(), now: NOW, weeks: 2 });

    const [last, current] = t.weeks;
    expect(current.sessions).toBe(2);
    expect(current.activeDays).toBe(2);
    expect(current.completedSets).toBe(3);
    expect(current.volume).toBeCloseTo(60 * 5 + 62.5 * 5);
    expect(current.trainingMinutes).toBeCloseTo(75);
    expect(last.sessions).toBe(1);
    expect(last.volume).toBeCloseTo(55 * 8);

    // Weekday pattern: Mon=1, Wed=1, Sun=1
    expect(t.weekdayPattern.map((p) => p.sessions)).toEqual([1, 0, 1, 0, 0, 0, 1]);

    const squat = t.exerciseTrends.find((e) => e.exerciseId === 'ex-squat')!;
    expect(squat.name).toBe('Squat');
    expect(squat.points[1].topWeight).toBe(62.5);
    expect(squat.points[0].topWeight).toBe(55);
    expect(squat.points[1].totalReps).toBe(10);
  });

  it('converts weights and log units into the user\'s current display units', () => {
    const t = computeTrends({
      workouts: [workout('a', '2025-11-11T08:00:00Z', 30)],
      sets: [set('a', 'ex-squat', 45.359237, 10)], // 100 lb
      logs: [
        log('sleep', 420, 'min', '2025-11-11T07:00:00Z'), // 7h
        log('sleep', 8, 'h', '2025-11-12T07:00:00Z'),
        log('activity', 1.5, 'h', '2025-11-12T17:00:00Z'), // 90 min
        log('activity', 30, 'min', '2025-11-08T17:00:00Z'), // last week Sat
        log('mood', 3, 'of5', '2025-11-11T20:00:00Z'), // -> 5.5 on a 10 scale
        log('mood', 8, 'of10', '2025-11-12T20:00:00Z'),
        log('energy', 4, 'bogus-unit', '2025-11-12T20:00:00Z'), // unknown unit -> skipped
        log('note', null, null, '2025-11-12T21:00:00Z'),
      ],
      routine: defaultRoutine(),
      exercises,
      settings: settings({ weightUnit: 'lb', sleepUnit: 'h', activityUnit: 'min', moodScale: 'of10' }),
      now: NOW,
      weeks: 2,
    });
    const current = t.weeks[1];
    expect(current.volume).toBeCloseTo(1000); // 100 lb x 10
    expect(current.sleepAverage).toBeCloseTo(7.5);
    expect(current.activityTotal).toBeCloseTo(90);
    expect(current.moodAverage).toBeCloseTo((5.5 + 8) / 2);
    expect(current.energyAverage).toBeNull();
    expect(current.noteCount).toBe(1);
    // Workout on Tue + activity on Wed = 2 active days
    expect(current.activeDays).toBe(2);
    expect(t.weeks[0].activityTotal).toBe(30);
    expect(t.consistency).toEqual({ weeksWithActivity: 2, totalWeeks: 2, averageActiveDays: 1.5 });
  });

  it('describes patterns neutrally, includes rest days, and never uses judgmental words', () => {
    const t = computeTrends({
      workouts: [workout('a', '2025-11-10T08:00:00Z', 40)],
      sets: [set('a', 'ex-squat', 50, 5)],
      logs: [log('sleep', 6, 'h', '2025-11-11T07:00:00Z'), log('mood', 2, 'of5', '2025-11-11T07:00:00Z')],
      routine: defaultRoutine(),
      exercises,
      settings: settings(),
      now: NOW,
      weeks: 4,
    });
    expect(t.observations.length).toBeGreaterThan(0);
    expect(t.observations.join(' ')).toContain('Rest days are part of the plan');
    expect(t.observations).toContain('Sessions most often land on Monday.');
    expect(hasDisallowedLanguage(t.observations)).toBeNull();
  });

  it('flags judgmental language in the guard rail helper', () => {
    expect(hasDisallowedLanguage(['You missed 2 workouts'])).toBe('missed');
    expect(hasDisallowedLanguage(['3 sessions this week'])).toBeNull();
  });

  it('clamps the week window and tolerates bad dates', () => {
    const t = computeTrends({
      workouts: [{ id: 'x', templateId: null, name: 'W', startedAt: 'not-a-date', endedAt: '2025-11-10T08:00:00Z', notes: '' }],
      sets: [],
      logs: [log('sleep', 7, 'h', 'garbage')],
      routine: [],
      exercises,
      settings: settings(),
      now: NOW,
      weeks: 0,
    });
    expect(t.weeks).toHaveLength(1);
    expect(t.isEmpty).toBe(true);
  });
});
