import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { openBrowserDatabase } from './browserDb';
import type { Db, SqlParam } from './types';

export const DATABASE_NAME = 'steady-log.db';

/** Build published as a single Claude page (see scripts/build-artifact.mjs). */
export const IS_PAGE_BUILD = Platform.OS === 'web' && process.env.EXPO_PUBLIC_TARGET === 'artifact';

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

export interface OpenedDatabase {
  db: Db;
  /** Human-readable location shown on the "Your data" screen. */
  path: string;
  /** False when data will not survive closing the app/page. */
  persistent: boolean;
}

export async function openAppDatabase(): Promise<OpenedDatabase> {
  if (IS_PAGE_BUILD) {
    const b = await openBrowserDatabase();
    return { db: b.db, path: b.label, persistent: b.persistent };
  }
  const raw = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const path = Platform.OS === 'web' ? 'almacenamiento del navegador (OPFS) de este sitio' : raw.databasePath;
  return { db: wrapExpoDatabase(raw), path, persistent: true };
}
