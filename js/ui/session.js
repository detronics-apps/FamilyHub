// A timed activity: "I'm doing this now, for about N minutes".
//
// Three separate systems, on purpose (requirement W3):
//   - the timer (js/timer.js): counts, and says when time is up
//   - completion: whatever the activity's own Done does (e.g. recording a chore)
//   - music (js/ui/media.js): optional, offered here, never in the way
// The timer ending only ever affects the music and shows a gentle line; it
// never completes, skips or reschedules anything. Done works at any moment,
// whatever the music is doing. Cancel ends it with nothing recorded. Left running
// far past the expected time, it asks "Still on it?" and, unanswered, stops (D-080).

import { el, svg } from './dom.js';
import { startTimer, pauseTimer, resumeTimer, remainingMs, elapsedMs, isFinished, fmtClock, checkInMs, checkState, overMs, ringOf } from '../timer.js';
import { END_ACTION_LABEL } from '../music.js';

export function createSession(ctx) {
  let s = null;
  let tick = null;

  const now = () => Date.now();

  function startTicking() {
    clearInterval(tick);
    tick = setInterval(() => {
      if (!s) { clearInterval(tick); return; }
      const clock = document.querySelector('[data-session-clock]');
      if (clock) clock.textContent = clockText();
      const ring = ringOf(s.timer, now());
      const arc = document.querySelector('[data-session-ring]');
      if (arc) arc.setAttribute('stroke-dashoffset', String(RING * (1 - ring.fill)));
      if (ring.over !== s.over) { s.over = ring.over; ctx.render(); }
      const check = checkState(s.timer, now(), s.nextCheck, s.askedAt);
      if (check === 'stop') {
        // Nobody answered: they have moved on. Nothing is recorded.
        const { title } = s;
        s = null;
        clearInterval(tick);
        if (ctx.media.state.status === 'playing') ctx.media.stop();
        ctx.flash?.({ id: `timer-stopped:${Date.now()}`, level: 'info', text: `The timer for "${title}" stopped by itself - nobody answered "Still on it?". Nothing was recorded; if it was done, press Done on it.` });
        ctx.render();
        return;
      }
      if (check === 'ask' && s.askedAt == null) { s.askedAt = elapsedMs(s.timer, now()); ctx.render(); }
      if (!s.ended && isFinished(s.timer, now())) {
        s.ended = true;
        const action = ctx.app.device.music.endAction;
        if (ctx.media.state.status === 'playing') {
          if (action === 'ask') s.askEnd = true;
          else ctx.media.onTimerEnd(action);
        }
        ctx.render();
      }
    }, 500);
  }

  function clockText() {
    if (!s) return '';
    const left = remainingMs(s.timer, now());
    const over = overMs(s.timer, now());
    if (over) return `+${fmtClock(over)} over`;
    return left == null ? `${fmtClock(elapsedMs(s.timer, now()))} so far` : `${fmtClock(left)} left`;
  }

  return {
    /**
     * Start an activity. `onDone` is the activity's own completion (it may be
     * absent). Starting a new one while music plays keeps the music going.
     * Call from a click: music may start straight away if the person chose "always".
     */
    start({ id, title, minutes = null, onDone = null }) {
      const timer = startTimer(minutes, now());
      s = { id, title, timer, onDone, ended: false, askEnd: false, musicAnswered: false, over: false, nextCheck: checkInMs(timer), askedAt: null };
      startTicking();
      const prefs = ctx.app.device.music;
      if (prefs.offer === 'always') { s.musicAnswered = true; ctx.media.start(); }
      if (prefs.offer === 'never') s.musicAnswered = true;
      ctx.render();
    },
    state: () => s,
    clockText,
    pause() { if (s) { s.timer = pauseTimer(s.timer, now()); ctx.render(); } },
    resume() { if (s) { s.timer = resumeTimer(s.timer, now()); ctx.render(); } },
    /** "Still on it?" - yes: ask again as far on. */
    stillGoing() { if (s) { s.nextCheck = elapsedMs(s.timer, now()) + checkInMs(s.timer); s.askedAt = null; ctx.render(); } },
    /** Cancel: end the activity, nothing recorded. Music carries on until it is stopped. */
    stop() { s = null; clearInterval(tick); ctx.render(); },
    /** Done: the activity's own completion, given the minutes it took (paused time left out). */
    done() {
      const finish = s?.onDone;
      const minutes = s ? Math.max(1, Math.round(elapsedMs(s.timer, now()) / 60000)) : null;
      s = null;
      clearInterval(tick);
      try { finish?.(minutes); } finally { ctx.render(); }
    },
    answerMusic(yes, remember) {
      if (!s) return;
      s.musicAnswered = true;
      if (remember) ctx.setDevice({ music: { ...ctx.app.device.music, offer: yes ? 'always' : 'never' } });
      if (yes) ctx.media.start(); else ctx.render();
    },
    answerEnd(keep) {
      if (!s) return;
      s.askEnd = false;
      if (!keep) ctx.media.stop();
      ctx.render();
    },
    // For mini-apps (hub.timer): the same session, without chore-specific wiring.
    isActive: () => Boolean(s),
  };
}

/** The panel shown above every screen while an activity is running. */
export function sessionPanel(ctx) {
  const session = ctx.session;
  const s = session.state();
  const m = ctx.media.state;
  const paused = s.timer.pausedAt != null;
  const musicOn = m.status === 'playing' || m.status === 'paused' || m.status === 'loading';
  const remember = el('input', { type: 'checkbox', id: 'music-remember', 'data-field': 'music-remember' });

  return el('section', { class: 'session panel', 'aria-label': 'Timed activity' }, [
    el('div', { class: 'session__top' }, [
      el('div', { class: 'list__main' }, [
        el('div', { class: 'card__label', text: 'Doing now' }),
        el('div', { class: 'card__title', text: s.title }),
      ]),
      s.timer.durationMs != null ? ringView(s) : null,
      el('div', { class: 'session__clock', 'data-session-clock': '', 'aria-live': 'off', text: session.clockText() }),
    ]),
    s.askedAt != null ? el('div', { class: 'row session__ask', role: 'alert', 'data-field': 'session-ask' }, [
      el('span', { class: 'small', text: `Still on it? That is ${fmtClock(elapsedMs(s.timer, Date.now()))} so far. If nobody answers in half an hour, the timer stops and nothing is recorded.` }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Still going', 'data-field': 'session-still', on: { click: () => session.stillGoing() } }),
    ]) : null,
    s.ended ? el('p', { class: 'small', role: 'status', text: 'Time’s up. Finish when you’re ready - or stop here. Both are fine.' }) : null,
    s.askEnd ? el('div', { class: 'row', role: 'group', 'aria-label': 'Music after the timer' }, [
      el('span', { class: 'small', text: 'Keep the music playing?' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Keep playing', on: { click: () => session.answerEnd(true) } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Stop music', on: { click: () => session.answerEnd(false) } }),
    ]) : null,
    !s.musicAnswered && !musicOn ? el('div', { class: 'session__music', role: 'group', 'aria-label': 'Music while you work' }, [
      el('span', { class: 'small', text: 'Music while you work?' }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Play music', 'data-field': 'music-yes', on: { click: () => session.answerMusic(true, remember.checked) } }),
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'No thanks', 'data-field': 'music-no', on: { click: () => session.answerMusic(false, remember.checked) } }),
      el('label', { class: 'checkline small', for: 'music-remember' }, [remember, 'Remember my answer']),
    ]) : null,
    m.status === 'error' && m.error ? el('p', { class: 'small muted', role: 'status', text: m.error }) : null,
    el('div', { class: 'card__actions' }, [
      el('button', { class: 'btn btn-small', type: 'button', text: 'Cancel', title: 'Stop the timer - nothing is recorded', 'data-field': 'session-stop', on: { click: () => session.stop() } }),
      paused
        ? el('button', { class: 'btn btn-small', type: 'button', text: 'Resume', on: { click: () => session.resume() } })
        : el('button', { class: 'btn btn-small', type: 'button', text: 'Pause', on: { click: () => session.pause() } }),
      s.onDone ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Done', 'data-field': 'session-done', on: { click: () => session.done() } }) : null,
    ]),
    musicOn && s.timer.durationMs != null && !s.ended
      ? el('p', { class: 'small muted', text: `When the timer ends: ${END_ACTION_LABEL[ctx.app.device.music.endAction].toLowerCase()} (change in Settings › Music).` })
      : null,
  ]);
}

/* The ring: fills to the expected time; past it, it turns honey and fills a second lap. */
const R = 22;
const RING = 2 * Math.PI * R;
function ringView(s) {
  const { fill, over } = ringOf(s.timer, Date.now());
  return svg('svg', { class: `session__ring${over ? ' session__ring--over' : ''}`, viewBox: '0 0 52 52', width: 52, height: 52, 'aria-hidden': 'true' }, [
    svg('circle', { cx: 26, cy: 26, r: R, class: over ? 'session__ring-full' : 'session__ring-track' }),
    svg('circle', { cx: 26, cy: 26, r: R, class: 'session__ring-fill', 'data-session-ring': '', 'stroke-dasharray': String(RING), 'stroke-dashoffset': String(RING * (1 - fill)), transform: 'rotate(-90 26 26)' }),
  ]);
}
