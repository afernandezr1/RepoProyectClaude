import type { Db } from './types';

/**
 * Ordered migrations. Each runs once; PRAGMA user_version tracks progress.
 * Never edit a shipped migration — append a new one.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('weight_reps','reps','duration','distance')),
    builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS template_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    position INTEGER NOT NULL,
    target_sets INTEGER NOT NULL,
    target_reps INTEGER,
    rest_seconds INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_te_template ON template_exercises(template_id);

  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT,
    name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_started ON workouts(started_at);

  CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    set_index INTEGER NOT NULL,
    weight_kg REAL,
    reps INTEGER,
    duration_seconds INTEGER,
    distance_m REAL,
    rest_seconds INTEGER NOT NULL DEFAULT 90,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
  CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);

  CREATE TABLE IF NOT EXISTS log_entries (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('activity','sleep','mood','energy','note')),
    value REAL,
    unit TEXT,
    text TEXT NOT NULL DEFAULT '',
    logged_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT UNIQUE
  );
  CREATE INDEX IF NOT EXISTS idx_logs_logged ON log_entries(logged_at);

  CREATE TABLE IF NOT EXISTS routine_days (
    weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    kind TEXT NOT NULL CHECK (kind IN ('workout','rest','open')),
    template_id TEXT,
    note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    hour INTEGER NOT NULL,
    minute INTEGER NOT NULL,
    weekdays TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  await db.exec('PRAGMA foreign_keys = ON;');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    const next = version + 1;
    await db.transaction(async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return version;
}

/** Tables holding user data, in safe delete order (children first). */
export const USER_TABLES = [
  'workout_sets',
  'workouts',
  'template_exercises',
  'templates',
  'log_entries',
  'routine_days',
  'reminders',
  'exercises',
  'settings',
  'meta',
] as const;
