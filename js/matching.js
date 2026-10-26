// "What can I do now?" - match chores to the person's current reality.
//
// Filters exclude; they never score. What passes is ordered by a short,
// readable list of rules (no hidden "perfect score"), and every suggestion
// carries the reasons it was put where it is, so the screen can say why.

import { blockedBy, occurrences } from './recurrence.js';
import { EFFORTS, roleOf } from './model.js';
import { intervalDays } from './dates.js';

export const TIME_CHOICES = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 20, label: '20 minutes' },
  { value: null, label: 'More time' },
];

export const ENERGY_CHOICES = [
  { value: 'low', label: 'Low energy' },
  { value: 'medium', label: 'Okay' },
  { value: 'high', label: 'Up for something bigger' },
];

export const defaultFilters = () => ({
  minutes: null,          // null = no time limit given
  energy: null,           // null = not said
  roomId: 'any',          // 'any' or a room id
  avoidRooms: [],         // rooms to leave out of "anywhere"
  personId: null,         // who is asking; null = anyone
  allowOverrun: false,    // let a longer task through a time filter
  includeNotDue: false,   // also show recurring chores that are not due yet
});

const rank = (effort) => EFFORTS.indexOf(effort);

/** Can this person do this chore? Children see only chores they are named on. */
export function eligible(chore, person) {
  if (!person) return true;
  if (chore.eligible.length) return chore.eligible.includes(person.id);
  return person.role !== 'child';
}

/**
 * Every chore that fits, in suggestion order.
 * @returns {Array<{chore, occ, reasons: string[], blocked: Array}>}
 */
export function findTasks(household, filters, today) {
  const f = { ...defaultFilters(), ...filters };
  const found = household.people.find((p) => p.id === f.personId) || null;
  // Adult or child follows the birthday, so a child moves on to grown-up chores at 18 by themselves.
  const person = found && { ...found, role: roleOf(found, today) };
  const occ = occurrences(household, today);
  const out = [];

  for (const chore of household.chores) {
    const o = occ.get(chore.id);
    if (o.state === 'closed') continue;
    const optional = o.category === 'optional';
    if (o.state === 'waiting' && !optional && !f.includeNotDue) continue;

    if (!eligible(chore, person)) continue;
    if (f.roomId !== 'any' && chore.roomId !== f.roomId) continue;
    if (f.roomId === 'any' && chore.roomId && f.avoidRooms.includes(chore.roomId)) continue;
    if (f.minutes != null && chore.minutes != null && chore.minutes > f.minutes && !f.allowOverrun) continue;
    if (f.energy && chore.effort && rank(chore.effort) > rank(f.energy)) continue;
    if (blockedBy(chore, household, occ).length) continue;

    out.push({ chore, occ: o, reasons: reasonsFor(chore, o, f) });
  }

  return out.sort(compare);
}

/**
 * The ordering, in plain words - also shown on screen under "Why these?".
 *   1. Ready before not-yet-due and optional.
 *   2. Important before normal before low.
 *   3. The one that has waited longest, as a share of its own cycle.
 *   4. The quicker one.
 *   5. Name, so the order is stable.
 */
export const ORDER_RULES = [
  'Ready now comes before optional or not-yet-due chores.',
  'Important chores come before ordinary ones.',
  'Then whatever has waited longest compared with how often it is meant to happen.',
  'Then the quicker one.',
];

const IMPORTANCE_RANK = { high: 0, normal: 1, low: 2 };

function compare(a, b) {
  const readyA = a.occ.state === 'ready' && a.occ.category !== 'optional' ? 0 : 1;
  const readyB = b.occ.state === 'ready' && b.occ.category !== 'optional' ? 0 : 1;
  if (readyA !== readyB) return readyA - readyB;
  const imp = IMPORTANCE_RANK[a.chore.importance] - IMPORTANCE_RANK[b.chore.importance];
  if (imp) return imp;
  const wait = overdueShare(b) - overdueShare(a);
  if (Math.abs(wait) > 1e-9) return wait;
  const mins = (a.chore.minutes ?? 999) - (b.chore.minutes ?? 999);
  if (mins) return mins;
  return a.chore.name.localeCompare(b.chore.name);
}

function overdueShare({ chore, occ }) {
  if (occ.state !== 'ready') return -1;
  return occ.waitingDays / (intervalDays(chore.frequency) ?? 7);   // a one-off counts as weekly
}

function reasonsFor(chore, o, f) {
  const r = [];
  if (o.category === 'important') r.push('Important');
  if (o.category === 'optional') r.push('Optional improvement');
  else if (o.state === 'waiting') r.push('Not due yet');
  else if (o.waitingDays > 0) r.push(`Ready for ${o.waitingDays} day${o.waitingDays === 1 ? '' : 's'}`);
  else r.push('Ready today');
  if (chore.minutes == null) r.push('Time not estimated');
  else if (f.minutes != null && chore.minutes > f.minutes) r.push('Longer than your time');
  if (!chore.effort) r.push('Effort not set');
  return r;
}

/**
 * A few next options after finishing one: something useful, something easy,
 * and something in the same room. Each is labelled, none repeats, and the
 * chore just done is never offered again.
 */
export function momentum(household, filters, today, justDoneId) {
  const doneRoom = household.chores.find((c) => c.id === justDoneId)?.roomId ?? null;
  const pool = findTasks(household, filters, today).filter((t) => t.chore.id !== justDoneId);
  const picks = [];
  const take = (label, match) => {
    const t = pool.find((x) => !picks.some((p) => p.chore.id === x.chore.id) && match(x));
    if (t) picks.push({ ...t, label });
  };

  take('Useful next', (t) => t.occ.state === 'ready' && t.occ.category !== 'optional');
  take('Quick and easy', (t) => (t.chore.minutes ?? 99) <= 10 && rank(t.chore.effort ?? 'medium') <= 0);
  if (doneRoom) take('While you are in there', (t) => t.chore.roomId === doneRoom);
  if (picks.length < 2) take('Also fits', () => true);
  return picks.slice(0, 3);
}
