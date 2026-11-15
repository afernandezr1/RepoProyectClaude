/**
 * Rest timer as plain data. Based on wall-clock end time so it stays correct
 * if the app is backgrounded or a JS interval is throttled.
 */
export interface RestTimer {
  /** Epoch ms when the timer reaches zero (when running). */
  endsAt: number | null;
  /** Remaining ms while paused. */
  pausedRemainingMs: number | null;
  totalMs: number;
}

export const IDLE_TIMER: RestTimer = { endsAt: null, pausedRemainingMs: null, totalMs: 0 };

export function startTimer(seconds: number, now: number): RestTimer {
  const ms = Math.max(0, Math.round(seconds)) * 1000;
  return { endsAt: now + ms, pausedRemainingMs: null, totalMs: ms };
}

export function remainingMs(t: RestTimer, now: number): number {
  if (t.pausedRemainingMs != null) return t.pausedRemainingMs;
  if (t.endsAt == null) return 0;
  return Math.max(0, t.endsAt - now);
}

export function isRunning(t: RestTimer, now: number): boolean {
  return t.endsAt != null && t.pausedRemainingMs == null && t.endsAt > now;
}

export function isActive(t: RestTimer): boolean {
  return t.endsAt != null || t.pausedRemainingMs != null;
}

export function isFinished(t: RestTimer, now: number): boolean {
  return t.endsAt != null && t.pausedRemainingMs == null && t.endsAt <= now;
}

export function pauseTimer(t: RestTimer, now: number): RestTimer {
  if (!isRunning(t, now)) return t;
  return { ...t, pausedRemainingMs: remainingMs(t, now), endsAt: null };
}

export function resumeTimer(t: RestTimer, now: number): RestTimer {
  if (t.pausedRemainingMs == null) return t;
  return { ...t, endsAt: now + t.pausedRemainingMs, pausedRemainingMs: null };
}

/** Add (or subtract with a negative value) seconds. Never goes below zero. */
export function adjustTimer(t: RestTimer, deltaSeconds: number, now: number): RestTimer {
  const delta = deltaSeconds * 1000;
  if (t.pausedRemainingMs != null) {
    const r = Math.max(0, t.pausedRemainingMs + delta);
    return { ...t, pausedRemainingMs: r, totalMs: Math.max(t.totalMs + delta, r) };
  }
  if (t.endsAt == null) return t;
  const r = Math.max(0, remainingMs(t, now) + delta);
  return { ...t, endsAt: now + r, totalMs: Math.max(t.totalMs + delta, r) };
}

export function progress(t: RestTimer, now: number): number {
  if (t.totalMs <= 0) return 0;
  return 1 - remainingMs(t, now) / t.totalMs;
}
