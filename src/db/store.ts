/**
 * All persistence goes through this class. It owns the SQL; screens only see
 * domain types. Every method is safe to call on a freshly migrated database.
 */
import type { BackupContent } from '../domain/backup';
import { newId } from '../domain/ids';
import { BUILTIN_EXERCISES, defaultRoutine, STARTER_TEMPLATES } from '../domain/routine';
import {
  DEFAULT_SETTINGS,
  type Exercise,
  type ExerciseKind,
  type LogEntry,
  type LogKind,
  type Reminder,
  type RoutineDay,
  type Settings,
  type Template,
  type TemplateExercise,
  type Weekday,
  type Workout,
  type WorkoutSet,
} from '../domain/types';
import { migrate, USER_TABLES } from './schema';
import type { Db, SqlParam } from './types';

type Row = Record<string, SqlParam>;

const mapExercise = (r: Row): Exercise => ({
  id: String(r.id),
  name: String(r.name),
  kind: r.kind as ExerciseKind,
  builtin: Number(r.builtin) === 1,
  createdAt: String(r.created_at),
});

const mapTemplateExercise = (r: Row): TemplateExercise => ({
  id: String(r.id),
  templateId: String(r.template_id),
  exerciseId: String(r.exercise_id),
  position: Number(r.position),
  targetSets: Number(r.target_sets),
  targetReps: r.target_reps == null ? null : Number(r.target_reps),
  restSeconds: Number(r.rest_seconds),
});

const mapWorkout = (r: Row): Workout => ({
  id: String(r.id),
  templateId: r.template_id == null ? null : String(r.template_id),
  name: String(r.name),
  startedAt: String(r.started_at),
  endedAt: r.ended_at == null ? null : String(r.ended_at),
  notes: String(r.notes ?? ''),
});

const numOrNull = (v: SqlParam) => (v == null ? null : Number(v));

const mapSet = (r: Row): WorkoutSet => ({
  id: String(r.id),
  workoutId: String(r.workout_id),
  exerciseId: String(r.exercise_id),
  position: Number(r.position),
  setIndex: Number(r.set_index),
  weightKg: numOrNull(r.weight_kg),
  reps: numOrNull(r.reps),
  durationSeconds: numOrNull(r.duration_seconds),
  distanceM: numOrNull(r.distance_m),
  restSeconds: Number(r.rest_seconds),
  completed: Number(r.completed) === 1,
  completedAt: r.completed_at == null ? null : String(r.completed_at),
});

const mapLog = (r: Row): LogEntry => ({
  id: String(r.id),
  kind: r.kind as LogKind,
  value: numOrNull(r.value),
  unit: r.unit == null ? null : String(r.unit),
  text: String(r.text ?? ''),
  loggedAt: String(r.logged_at),
  source: r.source === 'health' ? 'health' : 'manual',
});

const mapRoutine = (r: Row): RoutineDay => ({
  weekday: Number(r.weekday) as Weekday,
  kind: r.kind as RoutineDay['kind'],
  templateId: r.template_id == null ? null : String(r.template_id),
  note: String(r.note ?? ''),
});

function parseWeekdays(s: SqlParam): Weekday[] {
  try {
    const v = JSON.parse(String(s));
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) : [];
  } catch {
    return [];
  }
}

const mapReminder = (r: Row): Reminder => ({
  id: String(r.id),
  label: String(r.label),
  hour: Number(r.hour),
  minute: Number(r.minute),
  weekdays: parseWeekdays(r.weekdays),
  enabled: Number(r.enabled) === 1,
});

export interface WorkoutDetail {
  workout: Workout;
  sets: WorkoutSet[];
}

export interface HistoryItem {
  workout: Workout;
  completedSets: number;
  exerciseCount: number;
}

export interface SetPatch {
  weightKg?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  completed?: boolean;
}

export class Store {
  constructor(private readonly db: Db) {}

  /** Run migrations and seed fresh-install content (built-in exercises, starter templates, routine). */
  async init(now: Date = new Date()): Promise<void> {
    await migrate(this.db);
    await this.seedIfNeeded(now);
  }

  private async seedIfNeeded(now: Date): Promise<void> {
    const seeded = await this.db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'seeded'");
    const ts = now.toISOString();
    await this.db.transaction(async () => {
      for (const e of BUILTIN_EXERCISES) {
        await this.db.run(
          'INSERT OR IGNORE INTO exercises (id, name, kind, builtin, created_at) VALUES (?, ?, ?, 1, ?)',
          [e.id, e.name, e.kind, ts],
        );
      }
      if (seeded) return;
      for (const t of STARTER_TEMPLATES) {
        await this.db.run(
          'INSERT OR IGNORE INTO templates (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [t.id, t.name, t.notes, ts, ts],
        );
        let pos = 0;
        for (const e of t.exercises) {
          await this.db.run(
            `INSERT OR IGNORE INTO template_exercises
             (id, template_id, exercise_id, position, target_sets, target_reps, rest_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [`${t.id}-${pos}`, t.id, e.exerciseId, pos, e.targetSets, e.targetReps, e.restSeconds],
          );
          pos++;
        }
      }
      for (const d of defaultRoutine()) {
        await this.db.run(
          'INSERT OR IGNORE INTO routine_days (weekday, kind, template_id, note) VALUES (?, ?, ?, ?)',
          [d.weekday, d.kind, d.templateId, d.note],
        );
      }
      await this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)", [ts]);
    });
  }

  // ---------- settings ----------

  async getSettings(): Promise<Settings> {
    const row = await this.db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'app'");
    if (!row) return { ...DEFAULT_SETTINGS, health: { ...DEFAULT_SETTINGS.health } };
    try {
      const parsed = JSON.parse(row.value) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed, health: { ...DEFAULT_SETTINGS.health, ...(parsed.health ?? {}) } };
    } catch {
      // Corrupt settings should never brick the app.
      return { ...DEFAULT_SETTINGS, health: { ...DEFAULT_SETTINGS.health } };
    }
  }

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const next: Settings = {
      ...current,
      ...patch,
      health: { ...current.health, ...(patch.health ?? {}) },
    };
    await this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?)", [JSON.stringify(next)]);
    return next;
  }

  // ---------- exercises ----------

  async listExercises(): Promise<Exercise[]> {
    const rows = await this.db.all<Row>('SELECT * FROM exercises ORDER BY name COLLATE NOCASE');
    return rows.map(mapExercise);
  }

  async createExercise(name: string, kind: ExerciseKind, now = new Date()): Promise<Exercise> {
    const existing = await this.db.get<Row>('SELECT * FROM exercises WHERE name = ? COLLATE NOCASE', [name]);
    if (existing) return mapExercise(existing);
    const id = newId();
    await this.db.run('INSERT INTO exercises (id, name, kind, builtin, created_at) VALUES (?, ?, ?, 0, ?)', [
      id,
      name,
      kind,
      now.toISOString(),
    ]);
    return { id, name, kind, builtin: false, createdAt: now.toISOString() };
  }

  // ---------- templates ----------

  async listTemplates(): Promise<Template[]> {
    const ts = await this.db.all<Row>('SELECT * FROM templates ORDER BY name COLLATE NOCASE');
    const tes = await this.db.all<Row>('SELECT * FROM template_exercises ORDER BY position');
    const byTemplate = new Map<string, TemplateExercise[]>();
    for (const r of tes) {
      const te = mapTemplateExercise(r);
      const list = byTemplate.get(te.templateId) ?? [];
      list.push(te);
      byTemplate.set(te.templateId, list);
    }
    return ts.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      notes: String(r.notes ?? ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      exercises: byTemplate.get(String(r.id)) ?? [],
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    return (await this.listTemplates()).find((t) => t.id === id) ?? null;
  }

  async saveTemplate(
    input: {
      id?: string;
      name: string;
      notes: string;
      exercises: { exerciseId: string; targetSets: number; targetReps: number | null; restSeconds: number }[];
    },
    now = new Date(),
  ): Promise<string> {
    const id = input.id ?? newId();
    const ts = now.toISOString();
    await this.db.transaction(async () => {
      const existing = await this.db.get<Row>('SELECT id FROM templates WHERE id = ?', [id]);
      if (existing) {
        await this.db.run('UPDATE templates SET name = ?, notes = ?, updated_at = ? WHERE id = ?', [
          input.name,
          input.notes,
          ts,
          id,
        ]);
      } else {
        await this.db.run('INSERT INTO templates (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          id,
          input.name,
          input.notes,
          ts,
          ts,
        ]);
      }
      await this.db.run('DELETE FROM template_exercises WHERE template_id = ?', [id]);
      let pos = 0;
      for (const e of input.exercises) {
        await this.db.run(
          `INSERT INTO template_exercises (id, template_id, exercise_id, position, target_sets, target_reps, rest_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), id, e.exerciseId, pos++, e.targetSets, e.targetReps, e.restSeconds],
        );
      }
    });
    return id;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM template_exercises WHERE template_id = ?', [id]);
      await this.db.run('DELETE FROM templates WHERE id = ?', [id]);
      await this.db.run('UPDATE routine_days SET template_id = NULL WHERE template_id = ?', [id]);
    });
  }

  // ---------- workouts ----------

  async getActiveWorkout(): Promise<Workout | null> {
    const r = await this.db.get<Row>('SELECT * FROM workouts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    return r ? mapWorkout(r) : null;
  }

  /** Most recent completed values for an exercise, used to pre-fill new sets. */
  async lastCompletedSet(exerciseId: string): Promise<WorkoutSet | null> {
    const r = await this.db.get<Row>(
      `SELECT s.* FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.exercise_id = ? AND s.completed = 1 AND w.ended_at IS NOT NULL
       ORDER BY w.started_at DESC, s.set_index DESC LIMIT 1`,
      [exerciseId],
    );
    return r ? mapSet(r) : null;
  }

  async startWorkout(templateId: string | null, defaultRestSeconds: number, now = new Date()): Promise<string> {
    const active = await this.getActiveWorkout();
    if (active) return active.id; // only one in-progress workout at a time
    const template = templateId ? await this.getTemplate(templateId) : null;
    const id = newId();
    const prefill = new Map<string, WorkoutSet | null>();
    if (template) {
      for (const te of template.exercises) {
        if (!prefill.has(te.exerciseId)) prefill.set(te.exerciseId, await this.lastCompletedSet(te.exerciseId));
      }
    }
    await this.db.transaction(async () => {
      await this.db.run('INSERT INTO workouts (id, template_id, name, started_at, ended_at, notes) VALUES (?, ?, ?, ?, NULL, ?)', [
        id,
        template?.id ?? null,
        template?.name ?? 'Workout',
        now.toISOString(),
        '',
      ]);
      if (!template) return;
      for (const te of template.exercises) {
        const prev = prefill.get(te.exerciseId) ?? null;
        for (let i = 0; i < te.targetSets; i++) {
          await this.insertSet(id, te.exerciseId, te.position, i, {
            weightKg: prev?.weightKg ?? null,
            reps: te.targetReps ?? prev?.reps ?? null,
            durationSeconds: prev?.durationSeconds ?? null,
            distanceM: prev?.distanceM ?? null,
            restSeconds: te.restSeconds ?? defaultRestSeconds,
          });
        }
      }
    });
    return id;
  }

  private async insertSet(
    workoutId: string,
    exerciseId: string,
    position: number,
    setIndex: number,
    v: { weightKg: number | null; reps: number | null; durationSeconds: number | null; distanceM: number | null; restSeconds: number },
  ): Promise<string> {
    const id = newId();
    await this.db.run(
      `INSERT INTO workout_sets
       (id, workout_id, exercise_id, position, set_index, weight_kg, reps, duration_seconds, distance_m, rest_seconds, completed, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [id, workoutId, exerciseId, position, setIndex, v.weightKg, v.reps, v.durationSeconds, v.distanceM, v.restSeconds],
    );
    return id;
  }

  async getWorkout(id: string): Promise<WorkoutDetail | null> {
    const w = await this.db.get<Row>('SELECT * FROM workouts WHERE id = ?', [id]);
    if (!w) return null;
    const sets = await this.db.all<Row>('SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY position, set_index', [id]);
    return { workout: mapWorkout(w), sets: sets.map(mapSet) };
  }

  async addExerciseToWorkout(workoutId: string, exerciseId: string, restSeconds: number): Promise<void> {
    const r = await this.db.get<{ p: number | null }>('SELECT MAX(position) AS p FROM workout_sets WHERE workout_id = ?', [
      workoutId,
    ]);
    const prev = await this.lastCompletedSet(exerciseId);
    await this.insertSet(workoutId, exerciseId, (r?.p ?? -1) + 1, 0, {
      weightKg: prev?.weightKg ?? null,
      reps: prev?.reps ?? null,
      durationSeconds: prev?.durationSeconds ?? null,
      distanceM: prev?.distanceM ?? null,
      restSeconds,
    });
  }

  async addSet(workoutId: string, exerciseId: string, position: number): Promise<void> {
    const last = await this.db.get<Row>(
      'SELECT * FROM workout_sets WHERE workout_id = ? AND position = ? ORDER BY set_index DESC LIMIT 1',
      [workoutId, position],
    );
    const prev = last ? mapSet(last) : null;
    await this.insertSet(workoutId, exerciseId, position, (prev?.setIndex ?? -1) + 1, {
      weightKg: prev?.weightKg ?? null,
      reps: prev?.reps ?? null,
      durationSeconds: prev?.durationSeconds ?? null,
      distanceM: prev?.distanceM ?? null,
      restSeconds: prev?.restSeconds ?? 90,
    });
  }

  async updateSet(id: string, patch: SetPatch, now = new Date()): Promise<void> {
    const fields: string[] = [];
    const params: SqlParam[] = [];
    const map: [keyof SetPatch, string][] = [
      ['weightKg', 'weight_kg'],
      ['reps', 'reps'],
      ['durationSeconds', 'duration_seconds'],
      ['distanceM', 'distance_m'],
    ];
    for (const [k, col] of map) {
      if (k in patch) {
        fields.push(`${col} = ?`);
        params.push((patch[k] as number | null | undefined) ?? null);
      }
    }
    if (patch.completed !== undefined) {
      fields.push('completed = ?', 'completed_at = ?');
      params.push(patch.completed ? 1 : 0, patch.completed ? now.toISOString() : null);
    }
    if (fields.length === 0) return;
    params.push(id);
    await this.db.run(`UPDATE workout_sets SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async removeSet(id: string): Promise<void> {
    await this.db.run('DELETE FROM workout_sets WHERE id = ?', [id]);
  }

  /** Finish: drop sets that were never completed so history only holds what happened. */
  async finishWorkout(id: string, notes: string, now = new Date()): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM workout_sets WHERE workout_id = ? AND completed = 0', [id]);
      await this.db.run('UPDATE workouts SET ended_at = ?, notes = ? WHERE id = ? AND ended_at IS NULL', [
        now.toISOString(),
        notes,
        id,
      ]);
    });
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.db.transaction(async () => {
      await this.db.run('DELETE FROM workout_sets WHERE workout_id = ?', [id]);
      await this.db.run('DELETE FROM workouts WHERE id = ?', [id]);
    });
  }

  async listHistory(limit = 200): Promise<HistoryItem[]> {
    const rows = await this.db.all<Row>(
      `SELECT w.*,
         (SELECT COUNT(*) FROM workout_sets s WHERE s.workout_id = w.id AND s.completed = 1) AS completed_sets,
         (SELECT COUNT(DISTINCT exercise_id) FROM workout_sets s WHERE s.workout_id = w.id) AS exercise_count
       FROM workouts w WHERE w.ended_at IS NOT NULL ORDER BY w.started_at DESC LIMIT ?`,
      [limit],
    );
    return rows.map((r) => ({
      workout: mapWorkout(r),
      completedSets: Number(r.completed_sets),
      exerciseCount: Number(r.exercise_count),
    }));
  }

  async listAllWorkouts(): Promise<Workout[]> {
    return (await this.db.all<Row>('SELECT * FROM workouts ORDER BY started_at')).map(mapWorkout);
  }

  async listAllSets(): Promise<WorkoutSet[]> {
    return (await this.db.all<Row>('SELECT * FROM workout_sets ORDER BY workout_id, position, set_index')).map(mapSet);
  }

  // ---------- logs ----------

  async addLog(
    entry: { kind: LogKind; value: number | null; unit: string | null; text: string; loggedAt?: Date },
    now = new Date(),
  ): Promise<string> {
    const id = newId();
    await this.db.run(
      "INSERT INTO log_entries (id, kind, value, unit, text, logged_at, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')",
      [id, entry.kind, entry.value, entry.unit, entry.text, (entry.loggedAt ?? now).toISOString()],
    );
    return id;
  }

  /**
   * Insert or refresh a log imported from a health platform. Keyed by a stable
   * external id so repeated imports never duplicate entries.
   */
  async upsertHealthLog(entry: {
    externalId: string;
    kind: LogKind;
    value: number;
    unit: string;
    text: string;
    loggedAt: string;
  }): Promise<'inserted' | 'updated'> {
    const existing = await this.db.get<Row>('SELECT id FROM log_entries WHERE external_id = ?', [entry.externalId]);
    if (existing) {
      await this.db.run('UPDATE log_entries SET value = ?, unit = ?, text = ?, logged_at = ? WHERE id = ?', [
        entry.value,
        entry.unit,
        entry.text,
        entry.loggedAt,
        String(existing.id),
      ]);
      return 'updated';
    }
    await this.db.run(
      "INSERT INTO log_entries (id, kind, value, unit, text, logged_at, source, external_id) VALUES (?, ?, ?, ?, ?, ?, 'health', ?)",
      [newId(), entry.kind, entry.value, entry.unit, entry.text, entry.loggedAt, entry.externalId],
    );
    return 'inserted';
  }

  async listLogs(limit = 500): Promise<LogEntry[]> {
    return (await this.db.all<Row>('SELECT * FROM log_entries ORDER BY logged_at DESC LIMIT ?', [limit])).map(mapLog);
  }

  async deleteLog(id: string): Promise<void> {
    await this.db.run('DELETE FROM log_entries WHERE id = ?', [id]);
  }

  // ---------- routine ----------

  async getRoutine(): Promise<RoutineDay[]> {
    const rows = (await this.db.all<Row>('SELECT * FROM routine_days ORDER BY weekday')).map(mapRoutine);
    // Fill any gaps so the UI always has seven days.
    const byDay = new Map(rows.map((r) => [r.weekday, r]));
    return ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map(
      (w) => byDay.get(w) ?? { weekday: w, kind: 'open', templateId: null, note: '' },
    );
  }

  async saveRoutineDay(day: RoutineDay): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO routine_days (weekday, kind, template_id, note) VALUES (?, ?, ?, ?)', [
      day.weekday,
      day.kind,
      day.kind === 'workout' ? day.templateId : null,
      day.note,
    ]);
  }

  // ---------- reminders ----------

  async listReminders(): Promise<Reminder[]> {
    return (await this.db.all<Row>('SELECT * FROM reminders ORDER BY hour, minute')).map(mapReminder);
  }

  async saveReminder(r: Omit<Reminder, 'id'> & { id?: string }): Promise<string> {
    const id = r.id ?? newId();
    await this.db.run(
      'INSERT OR REPLACE INTO reminders (id, label, hour, minute, weekdays, enabled) VALUES (?, ?, ?, ?, ?, ?)',
      [id, r.label, r.hour, r.minute, JSON.stringify(r.weekdays), r.enabled ? 1 : 0],
    );
    return id;
  }

  async deleteReminder(id: string): Promise<void> {
    await this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }

  // ---------- backup / deletion ----------

  async exportAll(): Promise<BackupContent> {
    return {
      settings: await this.getSettings(),
      exercises: await this.listExercises(),
      templates: await this.listTemplates(),
      workouts: await this.listAllWorkouts(),
      sets: await this.listAllSets(),
      logs: (await this.db.all<Row>('SELECT * FROM log_entries ORDER BY logged_at')).map(mapLog),
      routine: await this.getRoutine(),
      reminders: await this.listReminders(),
    };
  }

  /** Replace all data with a validated backup (see parseBackup). Atomic. */
  async importAll(data: BackupContent): Promise<void> {
    await this.db.transaction(async () => {
      for (const t of USER_TABLES) {
        if (t === 'meta') continue;
        await this.db.run(`DELETE FROM ${t}`);
      }
      await this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?)", [JSON.stringify(data.settings)]);
      const ts = new Date().toISOString();
      for (const e of BUILTIN_EXERCISES) {
        await this.db.run('INSERT OR IGNORE INTO exercises (id, name, kind, builtin, created_at) VALUES (?, ?, ?, 1, ?)', [
          e.id,
          e.name,
          e.kind,
          ts,
        ]);
      }
      for (const e of data.exercises) {
        await this.db.run('INSERT OR REPLACE INTO exercises (id, name, kind, builtin, created_at) VALUES (?, ?, ?, ?, ?)', [
          e.id,
          e.name,
          e.kind,
          e.builtin ? 1 : 0,
          e.createdAt ?? ts,
        ]);
      }
      for (const t of data.templates) {
        await this.db.run('INSERT INTO templates (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          t.id,
          t.name,
          t.notes ?? '',
          t.createdAt ?? ts,
          t.updatedAt ?? ts,
        ]);
        let pos = 0;
        for (const e of t.exercises) {
          await this.db.run(
            `INSERT INTO template_exercises (id, template_id, exercise_id, position, target_sets, target_reps, rest_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [e.id ?? newId(), t.id, e.exerciseId, e.position ?? pos, e.targetSets, e.targetReps ?? null, e.restSeconds ?? 90],
          );
          pos++;
        }
      }
      for (const w of data.workouts) {
        await this.db.run('INSERT INTO workouts (id, template_id, name, started_at, ended_at, notes) VALUES (?, ?, ?, ?, ?, ?)', [
          w.id,
          w.templateId ?? null,
          w.name,
          w.startedAt,
          w.endedAt,
          w.notes ?? '',
        ]);
      }
      for (const s of data.sets) {
        await this.db.run(
          `INSERT INTO workout_sets
           (id, workout_id, exercise_id, position, set_index, weight_kg, reps, duration_seconds, distance_m, rest_seconds, completed, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.workoutId,
            s.exerciseId,
            s.position ?? 0,
            s.setIndex ?? 0,
            s.weightKg,
            s.reps,
            s.durationSeconds ?? null,
            s.distanceM ?? null,
            s.restSeconds ?? 90,
            s.completed ? 1 : 0,
            s.completedAt ?? null,
          ],
        );
      }
      for (const l of data.logs) {
        await this.db.run(
          'INSERT INTO log_entries (id, kind, value, unit, text, logged_at, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [l.id, l.kind, l.value, l.unit ?? null, l.text ?? '', l.loggedAt, l.source === 'health' ? 'health' : 'manual'],
        );
      }
      for (const d of data.routine) {
        await this.db.run('INSERT OR REPLACE INTO routine_days (weekday, kind, template_id, note) VALUES (?, ?, ?, ?)', [
          d.weekday,
          d.kind,
          d.templateId ?? null,
          d.note ?? '',
        ]);
      }
      for (const r of data.reminders) {
        await this.db.run(
          'INSERT INTO reminders (id, label, hour, minute, weekdays, enabled) VALUES (?, ?, ?, ?, ?, ?)',
          [r.id, r.label ?? 'Reminder', r.hour, r.minute, JSON.stringify(r.weekdays), r.enabled ? 1 : 0],
        );
      }
      await this.db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)", [ts]);
    });
  }

  /**
   * Delete every row of user data, then restore the fresh-install state
   * (built-in exercises, starter templates, default routine, default settings).
   */
  async deleteEverything(now = new Date()): Promise<void> {
    await this.db.transaction(async () => {
      for (const t of USER_TABLES) await this.db.run(`DELETE FROM ${t}`);
    });
    await this.db.exec('VACUUM');
    await this.seedIfNeeded(now);
  }

  async counts(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const t of USER_TABLES) {
      const r = await this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${t}`);
      out[t] = Number(r?.c ?? 0);
    }
    return out;
  }
}
