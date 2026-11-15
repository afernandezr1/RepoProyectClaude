export type SqlParam = string | number | null;

/**
 * Minimal async database interface. The app uses expo-sqlite; tests use
 * sql.js (real SQLite compiled to WASM) through the same interface, so the
 * exact same SQL and migrations are exercised in both.
 */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<void>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  transaction(fn: () => Promise<void>): Promise<void>;
}
