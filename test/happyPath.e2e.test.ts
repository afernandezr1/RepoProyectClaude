/**
 * End-to-end happy path through the real persistence layer (SQLite via sql.js,
 * same migrations and SQL as the app):
 *
 *   first run -> start workout from a template -> log sets with rest ->
 *   finish -> history -> wellbeing logs -> trends -> export -> restore ->
 *   full deletion.
 */
import initSqlJs from 'sql.js';
import { buildBackup, logsToCsv, parseBackup, serializeBackup, setsToCsv } from '../src/domain/backup';
import { safeFilename } from '../src/domain/filenames';
import { startTimer, remainingMs } from '../src/domain/timer';
import { computeTrends, hasDisallowedLanguage } from '../src/domain/trends';
import { toKg } from '../src/domain/units';
import { validateLog, validateSet } from '../src/domain/validation';
import { Store } from '../src/db/store';
import { wrapSqlJs } from './sqljsDb';

async function freshStore() {
  const SQL = await initSqlJs();
  return new Store(wrapSqlJs(new SQL.Database()));
}

describe('happy path (end to end through SQLite)', () => {
  it('logs a templated workout, shows it in history and trends, exports, restores and deletes', async () => {
    const store = await freshStore();
    const t0 = new Date('2025-11-10T08:00:00Z'); // Monday
    await store.init(t0);

    // First run: starter content exists, no personal history yet.
    const templates = await store.listTemplates();
    expect(templates.map((t) => t.name)).toEqual(['Full Body A', 'Full Body B']);
    expect(await store.listHistory()).toEqual([]);
    expect((await store.getRoutine()).filter((d) => d.kind === 'rest')).toHaveLength(3);

    // User prefers pounds.
    const settings = await store.saveSettings({ weightUnit: 'lb' });

    // Start a workout from a template: sets are created from the plan.
    const tpl = templates[0];
    const workoutId = await store.startWorkout(tpl.id, settings.defaultRestSeconds, t0);
    expect((await store.getActiveWorkout())?.id).toBe(workoutId);
    // Starting again resumes the same workout instead of creating a second one.
    expect(await store.startWorkout(tpl.id, 90, t0)).toBe(workoutId);

    let detail = (await store.getWorkout(workoutId))!;
    const plannedSets = tpl.exercises.reduce((a, e) => a + e.targetSets, 0);
    expect(detail.sets).toHaveLength(plannedSets);
    expect(detail.sets[0].reps).toBe(10);

    // Complete every goblet squat set with a validated weight entered in lb.
    const goblet = detail.sets.filter((s) => s.exerciseId === 'ex-goblet');
    let clock = t0.getTime();
    for (const s of goblet) {
      const parsed = validateSet({ weight: '35', reps: '10', duration: '', distance: '' }, true);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      clock += 60_000;
      await store.updateSet(
        s.id,
        { weightKg: toKg(parsed.value.weight!, settings.weightUnit), reps: parsed.value.reps, completed: true },
        new Date(clock),
      );
      // Rest timer starts from the set's configured rest.
      const timer = startTimer(s.restSeconds, clock);
      expect(remainingMs(timer, clock + 30_000)).toBe(60_000);
    }
    // Add an extra push-up set and complete only the first push-up set.
    const pushups = detail.sets.filter((s) => s.exerciseId === 'ex-pushup');
    await store.addSet(workoutId, 'ex-pushup', pushups[0].position);
    await store.updateSet(pushups[0].id, { reps: 12, completed: true });

    // Finish: uncompleted sets are dropped.
    await store.finishWorkout(workoutId, 'Felt good', new Date(t0.getTime() + 50 * 60_000));
    expect(await store.getActiveWorkout()).toBeNull();
    detail = (await store.getWorkout(workoutId))!;
    expect(detail.sets).toHaveLength(goblet.length + 1);
    expect(detail.workout.notes).toBe('Felt good');

    const history = await store.listHistory();
    expect(history).toHaveLength(1);
    expect(history[0].completedSets).toBe(4);

    // Next workout pre-fills from the last completed values.
    const w2 = await store.startWorkout(tpl.id, 90, new Date('2025-11-12T08:00:00Z'));
    const d2 = (await store.getWorkout(w2))!;
    expect(d2.sets.find((s) => s.exerciseId === 'ex-goblet')!.weightKg).toBeCloseTo(toKg(35, 'lb'));
    await store.deleteWorkout(w2); // discard

    // Optional wellbeing logs.
    for (const input of [
      { kind: 'sleep' as const, value: '7.5', unit: 'h', text: '' },
      { kind: 'mood' as const, value: '4', unit: 'of5', text: 'calm' },
      { kind: 'activity' as const, value: '30', unit: 'min', text: 'walk' },
      { kind: 'note' as const, value: '', unit: null, text: 'Busy week' },
    ]) {
      const v = validateLog(input);
      expect(v.ok).toBe(true);
      if (v.ok) await store.addLog({ kind: input.kind, ...v.value, loggedAt: new Date('2025-11-11T07:00:00Z') });
    }
    expect(await store.listLogs()).toHaveLength(4);

    // Trends.
    const trends = computeTrends({
      workouts: await store.listAllWorkouts(),
      sets: await store.listAllSets(),
      logs: await store.listLogs(),
      routine: await store.getRoutine(),
      exercises: await store.listExercises(),
      settings: await store.getSettings(),
      now: new Date('2025-11-13T12:00:00Z'),
      weeks: 4,
    });
    const week = trends.weeks[trends.weeks.length - 1];
    expect(week.sessions).toBe(1);
    expect(week.activeDays).toBe(2); // workout Monday + walk Tuesday
    expect(week.volume).toBeCloseTo(35 * 10 * 3);
    expect(week.sleepAverage).toBe(7.5);
    expect(hasDisallowedLanguage(trends.observations)).toBeNull();

    // Export.
    const backup = buildBackup(await store.exportAll(), new Date('2025-11-13T12:00:00Z'));
    const json = serializeBackup(backup);
    expect(safeFilename('steady-log-backup', 'json', new Date(2025, 10, 13, 12, 0, 0))).toBe(
      'steady-log-backup-20251113-120000.json',
    );
    expect(setsToCsv(backup).split('\n').filter(Boolean)).toHaveLength(1 + 4);
    expect(logsToCsv(backup)).toContain('Busy week');

    // Full deletion leaves no personal data, only fresh-install content.
    await store.deleteEverything(new Date('2025-11-13T12:00:00Z'));
    expect(await store.listHistory()).toEqual([]);
    expect(await store.listLogs()).toEqual([]);
    expect((await store.getSettings()).weightUnit).toBe('kg');
    const counts = await store.counts();
    expect(counts.workouts).toBe(0);
    expect(counts.workout_sets).toBe(0);
    expect(counts.log_entries).toBe(0);
    expect(counts.reminders).toBe(0);

    // Restore from the exported backup.
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await store.importAll(parsed.value);
    expect(await store.listHistory()).toHaveLength(1);
    expect(await store.listLogs()).toHaveLength(4);
    expect((await store.getSettings()).weightUnit).toBe('lb');
    // Re-initialising (next app launch) does not duplicate starter templates.
    await store.init();
    expect(await store.listTemplates()).toHaveLength(2);
  });

  it('rolls back a failed restore and keeps existing data', async () => {
    const store = await freshStore();
    await store.init();
    await store.addLog({ kind: 'note', value: null, unit: null, text: 'keep me' });
    const bad = parseBackup(
      JSON.stringify({
        format: 'steady-log-backup',
        version: 1,
        workouts: [{ id: 'w', name: 'x', startedAt: '2025-01-01T00:00:00Z', endedAt: null }],
        // duplicate primary keys force a SQL failure mid-import
        logs: [
          { id: 'dup', kind: 'note', value: null, loggedAt: '2025-01-01T00:00:00Z' },
          { id: 'dup', kind: 'note', value: null, loggedAt: '2025-01-01T00:00:00Z' },
        ],
      }),
    );
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    await expect(store.importAll(bad.value)).rejects.toThrow();
    const logs = await store.listLogs();
    expect(logs.map((l) => l.text)).toEqual(['keep me']);
  });
});
