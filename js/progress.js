// Household-level progress, told neutrally.
//
// Deliberately absent: any count per person, any ranking, any streak, and any
// "overdue" total. A pile of numbers about who did more is exactly what the
// product brief rules out (sections 3.7, 8.7, Phase 5.1).

import { addDays, dayDiff } from './dates.js';
import { occurrences } from './recurrence.js';
import { personName, roomName } from './model.js';

export function householdProgress(household, today, days = 7) {
  const since = addDays(today, -(days - 1));
  const occ = occurrences(household, today);
  const inWindow = (e) => e.type === 'done' && dayDiff(since, e.day) >= 0 && dayDiff(e.day, today) >= 0;

  const done = household.events.filter(inWindow);
  const ready = household.chores.filter((c) => occ.get(c.id).state === 'ready' && occ.get(c.id).category !== 'optional');
  const comingUp = household.chores.filter((c) => {
    const o = occ.get(c.id);
    return o.state === 'waiting' && dayDiff(today, o.dueDay) <= days;
  });
  const stillWaiting = ready.filter((c) => occ.get(c.id).category === 'important' || c.frequency.unit === 'once');
  const review = household.chores.filter((c) => occ.get(c.id).needsReview);

  const rooms = [...household.rooms.map((r) => r.id), null].map((id) => ({
    roomId: id,
    name: roomName(household, id),
    done: done.filter((e) => household.chores.find((c) => c.id === e.choreId)?.roomId === id).length,
    ready: ready.filter((c) => c.roomId === id).length,
  })).filter((r) => r.done || r.ready);

  return { days, doneCount: done.length, readyCount: ready.length, comingUpCount: comingUp.length, stillWaiting, review, rooms };
}

/** Newest first. What was done (or put off), when, and by whom. */
export function activity(household, limit = 30) {
  const LABEL = { done: 'Done', skipped: 'Skipped this time', deferred: 'Put off', rescheduled: 'Moved', dropped: 'No longer needed' };
  return household.events.slice().reverse().slice(0, limit).map((e) => {
    const chore = household.chores.find((c) => c.id === e.choreId);
    return {
      id: e.id,
      day: e.day,
      what: chore?.name ?? 'A removed chore',
      room: chore ? roomName(household, chore.roomId) : '',
      action: LABEL[e.type],
      who: personName(household, e.by),
      until: e.until,
      minutes: e.minutes,
    };
  });
}

/**
 * How much time the household's chores take, a week and on average a day - so the
 * work can be planned for ("about an hour a day"). Each repeating chore counts its
 * minutes as often as it comes round in a week (a monthly one counts 12/52 of a time).
 * One-off jobs and finished chores are left out; chores without a time are counted,
 * not guessed. Optional improvements are shown on their own.
 */
const PER_WEEK = { day: 7, week: 1, month: 12 / 52, year: 1 / 52 };
export function weeklyLoad(household) {
  let minutes = 0; let optional = 0; let unknown = 0; let counted = 0;
  const byRoom = new Map();
  for (const c of household.chores) {
    const per = PER_WEEK[c.frequency.unit];
    if (!per) continue;                          // one-off jobs
    if (household.events.some((e) => e.choreId === c.id && e.type === 'dropped')) continue;
    if (c.minutes == null) { unknown += 1; continue; }
    const m = (c.minutes * per) / Math.max(1, c.frequency.every);
    if (c.optional) { optional += m; continue; }
    minutes += m; counted += 1;
    byRoom.set(c.roomId, (byRoom.get(c.roomId) ?? 0) + m);
  }
  return {
    week: minutes, day: minutes / 7, optional, unknown, counted,
    rooms: [...byRoom].map(([id, m]) => ({ room: roomName(household, id), week: m })).sort((a, b) => b.week - a.week),
  };
}

/** "1 h 25 min", "40 min". */
export const fmtMinutes = (m) => { const r = Math.round(m); return r >= 60 ? `${Math.floor(r / 60)} h${r % 60 ? ` ${r % 60} min` : ''}` : `${r} min`; };
