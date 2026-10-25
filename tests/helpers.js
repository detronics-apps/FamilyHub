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

/**
 * A stand-in for a File System Access directory handle (what Chrome returns
 * when a person picks a folder), so createFolderStore runs its real code here.
 * `deny` makes every call throw NotAllowedError, as after a revoked permission.
 */
export function fakeDirectory(name = 'FamilyHub') {
  const state = { deny: false };
  const err = (n) => new DOMException(n, n);
  const make = (dirName) => {
    const children = new Map();
    const guard = () => { if (state.deny) throw err('NotAllowedError'); };
    const dir = {
      kind: 'directory',
      name: dirName,
      children,
      async getDirectoryHandle(n, { create = false } = {}) {
        guard();
        const c = children.get(n);
        if (c) { if (c.kind !== 'directory') throw err('TypeMismatchError'); return c; }
        if (!create) throw err('NotFoundError');
        const d = make(n);
        children.set(n, d);
        return d;
      },
      async getFileHandle(n, { create = false } = {}) {
        guard();
        const c = children.get(n);
        if (c) { if (c.kind !== 'file') throw err('TypeMismatchError'); return c; }
        if (!create) throw err('NotFoundError');
        const f = {
          kind: 'file',
          name: n,
          content: '',
          async getFile() { guard(); const text = f.content; return { name: n, size: text.length, text: async () => text }; },
          async createWritable() {
            guard();
            let buf = '';
            return { write: async (t) => { buf += t; }, close: async () => { f.content = buf; } };
          },
        };
        children.set(n, f);
        return f;
      },
      async* entries() { guard(); for (const [n, h] of children) yield [n, h]; },
      async removeEntry(n) { guard(); if (!children.delete(n)) throw err('NotFoundError'); },
    };
    return dir;
  };
  const root = make(name);
  root.state = state;
  return root;
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
