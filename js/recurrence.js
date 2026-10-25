// The current occurrence of a chore, derived from its definition and history.
//
// The rules (recorded in DECISIONS.md, D-008):
//   - A recurring chore has ONE current occurrence. Missing it does not create
//     another one, so a hectic week never turns into a pile.
//   - Next due = the day it was last done (or skipped) + one interval.
//     Before it has ever been done, it is ready from its start day.
//   - "Later" (deferred) and "Move to a date" (rescheduled) set the due day of
//     the current occurrence, until it is next done or skipped.
//   - A one-off chore stays ready until it is done or dropped. It never moves
//     on by itself: important unfinished work stays visible.
//   - Being put off repeatedly, or waiting two or more whole cycles, asks for a
//     review of the plan. It never adds work.

import { addInterval, dayDiff, intervalDays } from './dates.js';

const ANCHORS = new Set(['done', 'skipped']);
const MOVES = new Set(['deferred', 'rescheduled']);
const PUT_OFF = new Set(['skipped', 'deferred', 'rescheduled']);

/**
 * @returns {{ state: 'ready'|'waiting'|'closed', dueDay: string|null, waitingDays: number,
 *   missedCycles: number, putOffCount: number, needsReview: boolean,
 *   lastDone: {day:string, by:string|null}|null, category: 'routine'|'important'|'optional' }}
 */
export function occurrence(chore, events, today) {
  const mine = events.filter((e) => e.choreId === chore.id);
  const once = chore.frequency.unit === 'once';
  const lastDoneEvent = findLast(mine, (e) => e.type === 'done');
  const lastDone = lastDoneEvent ? { day: lastDoneEvent.day, by: lastDoneEvent.by } : null;

  let putOffCount = 0;
  for (let i = mine.length - 1; i >= 0 && PUT_OFF.has(mine[i].type); i -= 1) putOffCount += 1;

  const base = { lastDone, putOffCount, category: category(chore), waitingDays: 0, missedCycles: 0 };

  if (once) {
    if (mine.some((e) => e.type === 'done' || e.type === 'dropped')) {
      return { ...base, state: 'closed', dueDay: null, needsReview: false };
    }
  }

  let dueDay = chore.startDay;
  let anchorIndex = -1;
  if (!once) {
    anchorIndex = findLastIndex(mine, (e) => ANCHORS.has(e.type));
    if (anchorIndex >= 0) dueDay = addInterval(mine[anchorIndex].day, chore.frequency);
  }
  const move = findLast(mine.slice(anchorIndex + 1), (e) => MOVES.has(e.type) && e.until);
  if (move) dueDay = move.until;

  const waitingDays = Math.max(0, dayDiff(dueDay, today));
  const cycle = intervalDays(chore.frequency);
  const missedCycles = !once && cycle ? Math.floor(waitingDays / cycle) : 0;
  const state = dayDiff(today, dueDay) > 0 ? 'waiting' : 'ready';

  return {
    ...base,
    state,
    dueDay,
    waitingDays: state === 'ready' ? waitingDays : 0,
    missedCycles,
    needsReview: missedCycles >= 2 || putOffCount >= 3,
  };
}

/** routine: resumes its cycle; important: stays visible; optional: available, never urgent. */
export function category(chore) {
  if (chore.optional || chore.kind === 'improvement') return 'optional';
  if (chore.importance === 'high') return 'important';
  return 'routine';
}

/** Occurrences for every chore, keyed by id. */
export function occurrences(household, today) {
  const map = new Map();
  for (const chore of household.chores) map.set(chore.id, occurrence(chore, household.events, today));
  return map;
}

/** A chore waits for its dependencies: any that is ready, or a one-off not yet closed. */
export function blockedBy(chore, household, occ) {
  return chore.dependsOn
    .map((id) => household.chores.find((c) => c.id === id))
    .filter(Boolean)
    .filter((dep) => {
      const o = occ.get(dep.id);
      return o.state === 'ready' || (dep.frequency.unit === 'once' && o.state !== 'closed');
    });
}

function findLastIndex(list, pred) {
  for (let i = list.length - 1; i >= 0; i -= 1) if (pred(list[i])) return i;
  return -1;
}

function findLast(list, pred) {
  const i = findLastIndex(list, pred);
  return i >= 0 ? list[i] : null;
}
