/**
 * sql.js adapter (SQLite compiled to JS/WASM). Used by the Node tests and by
 * the browser-only build published as a Claude page. `onWrite` fires after
 * every statement that may have changed data (once per outer transaction).
 */
import type { Database } from 'sql.js';
import type { Db, SqlParam } from './types';

export function wrapSqlJs(db: Database, onWrite?: () => void): Db {
  let depth = 0;
  const changed = () => {
    if (depth === 0) onWrite?.();
  };
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
      changed();
    },
    run: async (sql, params = []) => {
      db.run(sql, params);
      changed();
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
        depth = 0;
        changed();
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth = 0;
      }
    },
  };
}
