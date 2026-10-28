// A timed activity, as data. The clock is passed in, so this never ticks by
// itself and is the same in a test and on screen. The timer knows nothing about
// music or completion: those are separate systems that may watch it.

export function startTimer(minutes, now) {
  const m = Number(minutes);
  return {
    startedAt: now,
    durationMs: Number.isFinite(m) && m > 0 ? Math.round(m * 60000) : null,   // null = open-ended
    pausedAt: null,
    pausedMs: 0,
  };
}

export function pauseTimer(t, now) {
  return t.pausedAt == null ? { ...t, pausedAt: now } : t;
}

export function resumeTimer(t, now) {
  return t.pausedAt == null ? t : { ...t, pausedAt: null, pausedMs: t.pausedMs + (now - t.pausedAt) };
}

export function elapsedMs(t, now) {
  const end = t.pausedAt ?? now;
  return Math.max(0, end - t.startedAt - t.pausedMs);
}

/** Milliseconds left, or null for an open-ended session. Never negative. */
export function remainingMs(t, now) {
  return t.durationMs == null ? null : Math.max(0, t.durationMs - elapsedMs(t, now));
}

export const isFinished = (t, now) => t.durationMs != null && remainingMs(t, now) === 0;

/** "4:05", or "1:02:03" past an hour. */
export function fmtClock(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/* Checking in (D-080). A chore taking much longer than expected still counts -
 * but a timer left running when someone wandered off should not run for hours.
 * At the check-in it asks "Still on it?"; left unanswered for ANSWER_MS, it stops
 * and nothing is recorded. "Still going" sets the next check-in as far again. */
const MIN = 60000;
export const ANSWER_MS = 30 * MIN;

/** When to ask: three times the expected time, at least half an hour (an hour if open-ended). */
export const checkInMs = (t) => (t.durationMs == null ? 60 * MIN : Math.max(30 * MIN, 3 * t.durationMs));

/** 'running' | 'ask' | 'stop', given the next check-in and when the question was first shown (elapsed ms). */
export function checkState(t, now, nextCheckMs, askedAtMs = null) {
  const e = elapsedMs(t, now);
  if (askedAtMs != null && e - askedAtMs >= ANSWER_MS) return 'stop';
  return e >= nextCheckMs ? 'ask' : 'running';
}

/** Time past the expected, 0 until then (and for an open-ended timer). */
export const overMs = (t, now) => (t.durationMs == null ? 0 : Math.max(0, elapsedMs(t, now) - t.durationMs));

/** The ring: how full (0..1) and whether it is past the expected time - a second lap, as long as the first. */
export function ringOf(t, now) {
  if (t.durationMs == null) return { fill: 0, over: false };
  const over = overMs(t, now);
  return over ? { fill: Math.min(1, over / t.durationMs), over: true } : { fill: elapsedMs(t, now) / t.durationMs, over: false };
}
