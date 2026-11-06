import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { openAppDatabase } from '../db/expoDb';
import { Store } from '../db/store';
import type { Settings } from '../domain/types';
import { configureNotifications } from '../services/notifications';

interface AppState {
  store: Store;
  settings: Settings;
  dbPath: string;
  /** Increments after every write so screens can reload. */
  version: number;
  bump: () => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

type Boot =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; store: Store; settings: Settings; dbPath: string };

export function useBoot() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { db, path } = await openAppDatabase();
        const store = new Store(db);
        await store.init();
        const settings = await store.getSettings();
        configureNotifications();
        if (!cancelled) setBoot({ status: 'ready', store, settings, dbPath: path });
      } catch (error) {
        if (!cancelled) setBoot({ status: 'error', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setBoot({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);
  return { boot, retry };
}

export function AppProvider({
  store,
  initialSettings,
  dbPath,
  children,
}: {
  store: Store;
  initialSettings: Settings;
  dbPath: string;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = await store.saveSettings(patch);
      setSettings(next);
      bump();
    },
    [store, bump],
  );
  const value = useMemo(
    () => ({ store, settings, dbPath, version, bump, updateSettings }),
    [store, settings, dbPath, version, bump, updateSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

/**
 * Load data for a screen; reloads when the screen gains focus or any write
 * happens (version bump). Keeps showing old data while refreshing.
 */
export function useLoad<T>(load: (store: Store) => Promise<T>, deps: unknown[] = []) {
  const { store, version } = useApp();
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const seq = useRef(0);
  // Callers pass small primitive deps (e.g. a route id); a stable key lets the
  // dependency list stay a literal.
  const depsKey = JSON.stringify(deps);

  const run = useCallback(() => {
    const my = ++seq.current;
    loadRef
      .current(store)
      .then((data) => {
        if (my === seq.current) setState({ status: 'ready', data });
      })
      .catch((error) => {
        if (my === seq.current) setState({ status: 'error', error });
      });
    // version/depsKey are intentional triggers: reload after writes or when params change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, depsKey]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    run();
  }, [run]);

  return { state, retry };
}
