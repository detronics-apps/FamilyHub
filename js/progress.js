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
    };
  });
}
