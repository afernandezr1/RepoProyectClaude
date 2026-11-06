/**
 * sql.js adapter: real SQLite (WASM) for Node tests. Not bundled into the app.
 */
import type { Database } from 'sql.js';
import type { Db, SqlParam } from '../src/db/types';

export function wrapSqlJs(db: Database): Db {
  let depth = 0;
  const all = <T,>(sql: string, params: SqlParam[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  };
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.run(sql, params);
    },
    all: async (sql, params) => all(sql, params),
    get: async <T,>(sql: string, params?: SqlParam[]) => all<T>(sql, params)[0] ?? null,
    transaction: async (fn) => {
      // sql.js has no nested transactions; emulate with a depth counter.
      if (depth > 0) {
        depth++;
        try {
          await fn();
        } finally {
          depth--;
        }
        return;
      }
      depth = 1;
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth = 0;
      }
    },
  };
}
