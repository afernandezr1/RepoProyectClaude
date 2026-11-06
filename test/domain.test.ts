import { buildBackup, csvCell, parseBackup, serializeBackup, setsToCsv } from '../src/domain/backup';
import { toNotificationWeekday } from '../src/domain/dates';
import { sessionsToLogs, sleepSegmentsToLogs } from '../src/domain/health';
import { safeFilename } from '../src/domain/filenames';
import { adjustTimer, isFinished, pauseTimer, remainingMs, resumeTimer, startTimer } from '../src/domain/timer';
import { DEFAULT_SETTINGS } from '../src/domain/types';
import { convertLogValue, fromKg, rescale, toKg } from '../src/domain/units';
import { parseNumberInput, validateLog, validateReminder, validateSet, validateTemplateExercise } from '../src/domain/validation';

describe('units', () => {
  it('round-trips kg and lb', () => {
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237);
    expect(fromKg(toKg(135, 'lb'), 'lb')).toBeCloseTo(135);
    expect(fromKg(80, 'kg')).toBe(80);
  });
  it('converts durations and rating scales', () => {
    expect(convertLogValue(90, 'min', 'h')).toBeCloseTo(1.5);
    expect(convertLogValue(2, 'h', 'min')).toBe(120);
    expect(rescale(1, 'of5', 'of10')).toBe(1);
    expect(rescale(5, 'of5', 'of10')).toBe(10);
    expect(rescale(10, 'of10', 'of5')).toBe(5);
    expect(convertLogValue(3, 'min', 'of5')).toBeNull();
  });
});

describe('validation', () => {
  it('parses numbers with dot or comma decimals and rejects garbage', () => {
    expect(parseNumberInput(' 12,5 ')).toBe(12.5);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('12kg')).toBeNaN();
    expect(parseNumberInput('1e9')).toBeNaN();
  });
  it('validates sets', () => {
    expect(validateSet({ weight: '60', reps: '8', duration: '', distance: '' }, true)).toEqual({
      ok: true,
      value: { weight: 60, reps: 8, durationSeconds: null, distance: null },
    });
    expect(validateSet({ weight: '', reps: '', duration: '', distance: '' }, true).ok).toBe(false);
    expect(validateSet({ weight: '-5', reps: '8', duration: '', distance: '' }, true).ok).toBe(false);
    expect(validateSet({ weight: '', reps: '8.5', duration: '', distance: '' }, true).ok).toBe(false);
  });
  it('validates template exercises with sensible defaults', () => {
    expect(validateTemplateExercise({ targetSets: '', targetReps: '', restSeconds: '' })).toEqual({
      ok: true,
      value: { targetSets: 3, targetReps: null, restSeconds: 90 },
    });
    expect(validateTemplateExercise({ targetSets: '50', targetReps: '', restSeconds: '' }).ok).toBe(false);
  });
  it('validates log entries per kind', () => {
    expect(validateLog({ kind: 'sleep', value: '7.5', unit: 'h', text: '' })).toEqual({
      ok: true,
      value: { value: 7.5, unit: 'h', text: '' },
    });
    expect(validateLog({ kind: 'sleep', value: '25', unit: 'h', text: '' }).ok).toBe(false);
    expect(validateLog({ kind: 'mood', value: '6', unit: 'of5', text: '' }).ok).toBe(false);
    expect(validateLog({ kind: 'mood', value: '6', unit: 'of10', text: '' }).ok).toBe(true);
    expect(validateLog({ kind: 'note', value: '', unit: null, text: '   ' }).ok).toBe(false);
    expect(validateLog({ kind: 'activity', value: '30', unit: 'stones', text: '' }).ok).toBe(false);
  });
  it('validates reminders', () => {
    expect(validateReminder({ label: 'Move', time: '7:05', weekdays: [2, 0, 2] })).toEqual({
      ok: true,
      value: { label: 'Move', hour: 7, minute: 5, weekdays: [0, 2] },
    });
    expect(validateReminder({ label: 'Move', time: '25:00', weekdays: [0] }).ok).toBe(false);
    expect(validateReminder({ label: 'Move', time: '07:00', weekdays: [] }).ok).toBe(false);
  });
  it('maps Monday-based weekdays to notification weekdays (1 = Sunday)', () => {
    expect(toNotificationWeekday(0)).toBe(2);
    expect(toNotificationWeekday(5)).toBe(7);
    expect(toNotificationWeekday(6)).toBe(1);
  });
});

describe('rest timer', () => {
  it('counts down from wall clock, pauses, resumes and adjusts', () => {
    let t = startTimer(90, 0);
    expect(remainingMs(t, 30_000)).toBe(60_000);
    t = pauseTimer(t, 30_000);
    expect(remainingMs(t, 999_999)).toBe(60_000);
    t = resumeTimer(t, 100_000);
    expect(remainingMs(t, 110_000)).toBe(50_000);
    t = adjustTimer(t, 15, 110_000);
    expect(remainingMs(t, 110_000)).toBe(65_000);
    t = adjustTimer(t, -600, 110_000);
    expect(remainingMs(t, 110_000)).toBe(0);
    expect(isFinished(t, 110_000)).toBe(true);
  });
});

describe('safeFilename', () => {
  const d = new Date(2025, 10, 13, 9, 5, 7);
  it('slugs, strips path tricks and stamps the date', () => {
    expect(safeFilename('Steady Log backup', 'json', d)).toBe('steady-log-backup-20251113-090507.json');
    expect(safeFilename('../../etc/passwd', 'csv')).toBe('etc-passwd.csv');
    expect(safeFilename('Séance été ✨', 'csv')).toBe('seance-ete.csv');
    expect(safeFilename('   ', 'json')).toBe('export.json');
    expect(safeFilename('CON', 'json')).toBe('con-file.json');
    expect(safeFilename('a'.repeat(200), 'json')).toHaveLength(60 + 5);
  });
  it('rejects unknown extensions', () => {
    expect(() => safeFilename('x', 'exe')).toThrow();
  });
});

describe('backup format', () => {
  const content = {
    settings: { ...DEFAULT_SETTINGS, weightUnit: 'lb' as const },
    exercises: [],
    templates: [],
    workouts: [{ id: 'w1', templateId: null, name: 'Morning', startedAt: '2025-11-10T08:00:00.000Z', endedAt: '2025-11-10T09:00:00.000Z', notes: '' }],
    sets: [
      { id: 's1', workoutId: 'w1', exerciseId: 'ex-squat', position: 0, setIndex: 0, weightKg: 45.359237, reps: 5, durationSeconds: null, distanceM: null, restSeconds: 90, completed: true, completedAt: null },
    ],
    logs: [{ id: 'l1', kind: 'note' as const, value: null, unit: null, text: '=HYPERLINK("x")', loggedAt: '2025-11-10T08:00:00.000Z', source: 'manual' as const }],
    routine: [],
    reminders: [],
  };

  it('round-trips through JSON', () => {
    const b = buildBackup(content, new Date('2025-11-13T00:00:00Z'));
    const parsed = parseBackup(serializeBackup(b));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.workouts).toEqual(content.workouts);
      expect(parsed.value.settings.weightUnit).toBe('lb');
    }
  });

  it('rejects files that are not backups or are inconsistent, with a readable error', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: "That file isn't valid JSON." });
    expect(parseBackup('{"format":"other"}').ok).toBe(false);
    const orphan = buildBackup({ ...content, workouts: [] }, new Date());
    const r = parseBackup(JSON.stringify(orphan));
    expect(r.ok).toBe(false);
    const future = { ...buildBackup(content, new Date()), version: 99 };
    expect(parseBackup(JSON.stringify(future))).toEqual({ ok: false, error: 'This backup was made by a newer version of the app.' });
  });

  it('writes CSV in display units and neutralises formula injection', () => {
    const csv = setsToCsv({ ...content, exercises: [{ id: 'ex-squat', name: 'Squat, back', kind: 'weight_reps', builtin: true, createdAt: '' }] });
    expect(csv.split('\n')[0]).toBe('workout_started_at,workout_name,exercise,set,weight_lb,reps,duration_s,distance_km');
    expect(csv).toContain('"Squat, back",1,100,5');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe('-5');
  });
});

describe('health sample shaping', () => {
  it('merges overlapping sleep segments into one entry per wake-up day', () => {
    const logs = sleepSegmentsToLogs(
      [
        { start: new Date('2025-11-10T23:00:00Z'), end: new Date('2025-11-11T03:00:00Z') },
        { start: new Date('2025-11-11T02:00:00Z'), end: new Date('2025-11-11T06:30:00Z') }, // overlaps (other source)
        { start: new Date('2025-11-11T23:30:00Z'), end: new Date('2025-11-12T06:00:00Z') },
        { start: new Date('2025-11-12T06:00:00Z'), end: new Date('2025-11-12T05:00:00Z') }, // invalid -> ignored
      ],
      'hk',
    );
    expect(logs.map((l) => [l.externalId, l.value])).toEqual([
      ['hk-sleep-2025-11-11', 450],
      ['hk-sleep-2025-11-12', 390],
    ]);
  });
  it('turns workout sessions into activity minutes with stable ids', () => {
    const [l] = sessionsToLogs([{ id: 'abc', title: 'Walk', start: new Date('2025-11-11T10:00:00Z'), end: new Date('2025-11-11T10:45:00Z') }], 'hc');
    expect(l).toMatchObject({ externalId: 'hc-workout-abc', kind: 'activity', value: 45, unit: 'min', text: 'Walk (imported)' });
  });
});
