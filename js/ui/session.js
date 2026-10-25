// A timed activity: "I'm doing this now, for about N minutes".
//
// Three separate systems, on purpose (requirement W3):
//   - the timer (js/timer.js): counts, and says when time is up
//   - completion: whatever the activity's own Done does (e.g. recording a chore)
//   - music (js/ui/media.js): optional, offered here, never in the way
// The timer ending only ever affects the music and shows a gentle line; it
// never completes, skips or reschedules anything. Done works at any moment,
// whatever the music is doing.

import { el } from './dom.js';
import { startTimer, pauseTimer, resumeTimer, remainingMs, elapsedMs, isFinished, fmtClock } from '../timer.js';
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
    return left == null ? `${fmtClock(elapsedMs(s.timer, now()))} so far` : `${fmtClock(left)} left`;
  }

  return {
    /**
     * Start an activity. `onDone` is the activity's own completion (it may be
     * absent). Starting a new one while music plays keeps the music going.
     * Call from a click: music may start straight away if the person chose "always".
     */
    start({ id, title, minutes = null, onDone = null }) {
      s = { id, title, timer: startTimer(minutes, now()), onDone, ended: false, askEnd: false, musicAnswered: false };
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
    /** End the activity (timer only). Music carries on until it is stopped. */
    stop() { s = null; clearInterval(tick); ctx.render(); },
    done() {
      const finish = s?.onDone;
      s = null;
      clearInterval(tick);
      try { finish?.(); } finally { ctx.render(); }
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
      el('div', { class: 'session__clock', 'data-session-clock': '', 'aria-live': 'off', text: session.clockText() }),
    ]),
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
      el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Stop timer', 'data-field': 'session-stop', on: { click: () => session.stop() } }),
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
