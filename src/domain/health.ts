/**
 * Platform-neutral shaping of health-platform samples into local log entries.
 * Read-only import; nothing here interprets the data medically.
 */
import { dayKey } from './dates';

export interface Interval {
  start: Date;
  end: Date;
}

export interface ImportedLog {
  externalId: string;
  kind: 'sleep' | 'activity';
  /** minutes */
  value: number;
  unit: 'min';
  text: string;
  loggedAt: string;
}

const minutes = (i: Interval) => Math.max(0, (i.end.getTime() - i.start.getTime()) / 60000);

/**
 * Sum asleep segments into one entry per day (keyed by the local day the
 * segment ends, i.e. the morning you woke up). Overlapping segments from
 * multiple sources are merged so time isn't double counted.
 */
export function sleepSegmentsToLogs(segments: Interval[], prefix: string): ImportedLog[] {
  const byDay = new Map<string, Interval[]>();
  for (const s of segments) {
    if (!(s.end > s.start)) continue;
    const k = dayKey(s.end);
    const list = byDay.get(k) ?? [];
    list.push(s);
    byDay.set(k, list);
  }
  const out: ImportedLog[] = [];
  for (const [day, list] of byDay) {
    const merged = mergeIntervals(list);
    const total = merged.reduce((a, i) => a + minutes(i), 0);
    if (total <= 0) continue;
    const last = merged[merged.length - 1];
    out.push({
      externalId: `${prefix}-sleep-${day}`,
      kind: 'sleep',
      value: Math.round(Math.min(total, 24 * 60)),
      unit: 'min',
      text: 'Imported from health app',
      loggedAt: last.end.toISOString(),
    });
  }
  return out.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const i of sorted) {
    const prev = out[out.length - 1];
    if (prev && i.start <= prev.end) {
      if (i.end > prev.end) prev.end = i.end;
    } else out.push({ start: new Date(i.start), end: new Date(i.end) });
  }
  return out;
}

export function sessionsToLogs(
  sessions: (Interval & { id: string; title?: string })[],
  prefix: string,
): ImportedLog[] {
  return sessions
    .filter((s) => s.end > s.start)
    .map((s) => ({
      externalId: `${prefix}-workout-${s.id}`,
      kind: 'activity' as const,
      value: Math.round(Math.min(minutes(s), 24 * 60)),
      unit: 'min' as const,
      text: s.title ? `${s.title} (imported)` : 'Workout (imported)',
      loggedAt: s.start.toISOString(),
    }));
}
