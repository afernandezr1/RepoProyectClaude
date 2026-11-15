/**
 * Browser-only storage for the build published as a Claude page.
 *
 * SQLite runs in the page via sql.js (pure-JS asm.js build, loaded by the page
 * as the global `initSqlJs`, so no WebAssembly or worker is needed). The whole
 * database file is kept in this browser's IndexedDB and saved shortly after
 * every change. Nothing is sent anywhere.
 *
 * If IndexedDB is unavailable (private window, blocked site data), the app
 * still runs from memory and says clearly that nothing will be kept.
 */
import type { SqlJsStatic } from 'sql.js';
import { wrapSqlJs } from './sqljsDb';
import type { Db } from './types';

const IDB_NAME = 'steady-log';
const IDB_STORE = 'files';
const IDB_KEY = 'steady-log.db';
const SAVE_DELAY_MS = 400;

export interface BrowserDatabase {
  db: Db;
  persistent: boolean;
  label: string;
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbGet(idb: IDBDatabase): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
  });
}

function idbPut(idb: IDBDatabase, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

export async function openBrowserDatabase(): Promise<BrowserDatabase> {
  const init = (globalThis as unknown as { initSqlJs?: () => Promise<SqlJsStatic> }).initSqlJs;
  if (!init) throw new Error('The SQLite engine did not load in this page.');
  const SQL = await init();

  let idb: IDBDatabase | null = null;
  let saved: Uint8Array | null = null;
  try {
    idb = await idbOpen();
    saved = await idbGet(idb);
  } catch {
    idb = null; // storage blocked: run from memory
  }

  const raw = saved ? new SQL.Database(saved) : new SQL.Database();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!idb) return;
    idbPut(idb, raw.export()).catch(() => {
      // Keep running; the next change retries the save.
    });
  };
  const schedule = () => {
    if (!idb) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  };

  const doc = (globalThis as unknown as { document?: Document }).document;
  if (doc) {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden' && timer) flush();
    });
  }
  globalThis.addEventListener?.('pagehide', () => {
    if (timer) flush();
  });

  return {
    db: wrapSqlJs(raw, schedule),
    persistent: idb !== null,
    label: idb
      ? 'this browser (IndexedDB), only for this page'
      : 'memory only — this browser is blocking storage, so data is lost when the page closes',
  };
}
