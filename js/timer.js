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
