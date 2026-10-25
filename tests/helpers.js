// Shared test fixtures. Not a test file itself (no .test.js suffix).
import { emptyHousehold, addChore, addRoom, addPerson } from '../js/model.js';

export const TODAY = '2026-10-25';

/** A small household: two rooms, two adults, one child, a handful of chores. */
export function fixture() {
  let h = emptyHousehold('Test family', '2026-09-01T08:00:00.000Z');
  let r;
  ({ household: h, room: r } = addRoom(h, 'Kitchen')); const kitchen = r.id;
  ({ household: h, room: r } = addRoom(h, 'Bathroom')); const bathroom = r.id;
  let p;
  ({ household: h, person: p } = addPerson(h, { name: 'Ann', role: 'adult' })); const ann = p.id;
  ({ household: h, person: p } = addPerson(h, { name: 'Kid', role: 'child' })); const kid = p.id;
  const add = (fields) => { const res = addChore(h, { startDay: '2026-10-20', ...fields }, '2026-09-01T08:00:00.000Z'); h = res.household; return res.chore.id; };
  const ids = {
    counters: add({ name: 'Wipe counters', roomId: kitchen, frequency: { unit: 'day', every: 1 }, minutes: 5, effort: 'low' }),
    oven: add({ name: 'Clean oven', roomId: kitchen, frequency: { unit: 'month', every: 3 }, minutes: 45, effort: 'high' }),
    floor: add({ name: 'Kitchen floor', roomId: kitchen, frequency: { unit: 'week', every: 1 }, minutes: 15, effort: 'medium' }),
    basin: add({ name: 'Clean basin', roomId: bathroom, frequency: { unit: 'week', every: 1 }, minutes: 5, effort: 'low', importance: 'high' }),
    bin: add({ name: 'Empty bin', roomId: bathroom, frequency: { unit: 'week', every: 1 }, minutes: 2, effort: 'low', eligible: [ann, kid] }),
    mystery: add({ name: 'Sort the garage', roomId: null, frequency: { unit: 'once', every: 1 } }),
  };
  return { h, kitchen, bathroom, ann, kid, ids };
}

/** A Storage-like object backed by a Map, for testing the local adapter in Node. */
export function memoryStorage() {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
