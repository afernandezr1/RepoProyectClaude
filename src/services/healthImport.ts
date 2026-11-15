import type { Store } from '../db/store';
import { addDays } from '../domain/dates';
import type { HealthDataType } from '../domain/types';
import { health } from './health';

/** Pull the last `days` of one opted-in data type into local logs. */
export async function importHealth(store: Store, type: HealthDataType, days = 30): Promise<{ added: number; updated: number }> {
  const until = new Date();
  const since = addDays(until, -days);
  const logs = await health.readRecent(type, since, until);
  let added = 0;
  let updated = 0;
  for (const l of logs) {
    const r = await store.upsertHealthLog(l);
    if (r === 'inserted') added++;
    else updated++;
  }
  return { added, updated };
}
