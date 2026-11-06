import * as SQLite from 'expo-sqlite';
import type { Db, SqlParam } from './types';

export const DATABASE_NAME = 'steady-log.db';

/** Wrap expo-sqlite in the small Db interface used by Store. */
export function wrapExpoDatabase(db: SQLite.SQLiteDatabase): Db {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      await db.runAsync(sql, params);
    },
    all: <T,>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    get: async <T,>(sql: string, params: SqlParam[] = []) => (await db.getFirstAsync<T>(sql, params)) ?? null,
    transaction: (fn) => db.withTransactionAsync(fn),
  };
}

export async function openAppDatabase(): Promise<{ db: Db; path: string }> {
  const raw = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return { db: wrapExpoDatabase(raw), path: raw.databasePath };
}
