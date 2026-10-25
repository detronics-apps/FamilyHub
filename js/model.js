// The household model: versioned, plain JSON, edited only through helpers that
// return a new household rather than mutating one. No DOM in here.
//
// Shape (schema 1):
//   { schema, household: {id, name, createdAt},
//     people: [Person], rooms: [Room], chores: [Chore], events: [Event] }
//
// A Chore is a *definition* ("Clean basin, weekly"). Each time it is acted on
// an Event is recorded (done / skipped / deferred / rescheduled / dropped).
// The current occurrence is derived from the definition plus its events, never
// stored, so changing a frequency can never erase history.
//
// Personal dashboard preferences are NOT part of this model; see dashboard.js.

import { isDay, toDay } from './dates.js';

export const SCHEMA_VERSION = 1;

export const ROLES = ['adult', 'child'];
export const EFFORTS = ['low', 'medium', 'high'];
export const IMPORTANCE = ['low', 'normal', 'high'];
export const KINDS = ['routine', 'maintenance', 'oneoff', 'improvement'];
export const UNITS = ['day', 'week', 'month', 'year', 'once'];
export const EVENT_TYPES = ['done', 'skipped', 'deferred', 'rescheduled', 'dropped'];
// Every record carries a visibility so private records can be added later
// without redesigning the model. Only 'shared' is offered in this version.
export const VISIBILITY = ['shared', 'private'];

export const PERSON_COLOURS = ['#d9734e', '#d9a441', '#8fae7e', '#c07aa6', '#d77a7a', '#b58a62'];

export function newId(prefix) {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

const nowIso = () => new Date().toISOString();
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

export function emptyHousehold(name = 'Our family', now = nowIso()) {
  return {
    schema: SCHEMA_VERSION,
    household: { id: newId('hh'), name: str(name, 80) || 'Our family', createdAt: now },
    people: [],
    rooms: [],
    chores: [],
    events: [],
  };
}

export function normalisePerson(p) {
  return {
    id: str(p.id, 40) || newId('p'),
    name: str(p.name, 40) || 'Someone',
    role: oneOf(p.role, ROLES, 'adult'),
    colour: PERSON_COLOURS.includes(p.colour) ? p.colour : PERSON_COLOURS[0],
    visibility: oneOf(p.visibility, VISIBILITY, 'shared'),
    demo: p.demo === true,
  };
}

export function normaliseRoom(r) {
  return {
    id: str(r.id, 40) || newId('r'),
    name: str(r.name, 40) || 'Room',
    demo: r.demo === true,
  };
}

export function normaliseFrequency(f) {
  const unit = oneOf(f?.unit, UNITS, 'week');
  const every = Math.min(999, Math.max(1, Math.round(Number(f?.every) || 1)));
  return { unit, every: unit === 'once' ? 1 : every };
}

/** Fill every field a chore may lack. Only `name` is required from a person. */
export function normaliseChore(c, now = nowIso()) {
  const created = typeof c.createdAt === 'string' ? c.createdAt : now;
  const frequency = normaliseFrequency(c.frequency);
  return {
    id: str(c.id, 40) || newId('c'),
    name: str(c.name, 120) || 'Untitled chore',
    description: str(c.description, 2000),
    roomId: typeof c.roomId === 'string' && c.roomId ? c.roomId : null,
    frequency,
    // The first day this chore counts as ready. Defaults to the day it was made.
    startDay: isDay(c.startDay) ? c.startDay : toDay(new Date(created)),
    minutes: numOrNull(c.minutes),
    effort: oneOf(c.effort, EFFORTS, null),
    importance: oneOf(c.importance, IMPORTANCE, 'normal'),
    kind: oneOf(c.kind, KINDS, frequency.unit === 'once' ? 'oneoff' : 'routine'),
    optional: c.optional === true,
    eligible: ids(c.eligible),
    dependsOn: ids(c.dependsOn),
    instructions: str(c.instructions, 4000),
    easier: str(c.easier, 2000),
    cost: numOrNull(c.cost),
    visibility: oneOf(c.visibility, VISIBILITY, 'shared'),
    demo: c.demo === true,
    createdAt: created,
    updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : created,
  };
}

export function normaliseEvent(e) {
  return {
    id: str(e.id, 40) || newId('e'),
    choreId: str(e.choreId, 40),
    type: oneOf(e.type, EVENT_TYPES, null),
    day: isDay(e.day) ? e.day : null,
    at: typeof e.at === 'string' ? e.at : null,
    by: typeof e.by === 'string' ? e.by : null,
    dueDay: isDay(e.dueDay) ? e.dueDay : null,
    until: isDay(e.until) ? e.until : null,
    note: str(e.note, 1000),
  };
}

/* ------------------------------------------------------------------------ *
 * Migration. Each step takes version n to n + 1. Version 0 is any household
 * saved before the `schema` field existed: same shape, fields may be missing.
 * ------------------------------------------------------------------------ */

const MIGRATIONS = {
  0: (raw) => ({ ...raw, schema: 1 }),
};

/** Bring a raw parsed object up to the current schema, then normalise it. Throws on garbage. */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This is not a Family Hub household.');
  let data = raw;
  let version = Number.isInteger(data.schema) ? data.schema : 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`This file was made by a newer version of Family Hub (data version ${version}). Update the app before opening it.`);
  }
  while (version < SCHEMA_VERSION) {
    data = MIGRATIONS[version](data);
    version += 1;
  }
  return normaliseHousehold(data);
}

export function normaliseHousehold(data) {
  const hh = data.household && typeof data.household === 'object' ? data.household : {};
  const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  const people = list(data.people).map(normalisePerson);
  const rooms = list(data.rooms).map(normaliseRoom);
  const roomIds = new Set(rooms.map((r) => r.id));
  const chores = list(data.chores).map((c) => normaliseChore(c))
    .map((c) => (c.roomId && !roomIds.has(c.roomId) ? { ...c, roomId: null } : c));
  const events = list(data.events).map(normaliseEvent).filter((e) => e.type && e.day && e.choreId);
  return {
    schema: SCHEMA_VERSION,
    household: {
      id: str(hh.id, 40) || newId('hh'),
      name: str(hh.name, 80) || 'Our family',
      createdAt: typeof hh.createdAt === 'string' ? hh.createdAt : nowIso(),
    },
    people,
    rooms,
    chores,
    events,
  };
}

/** Structural check on raw data before it replaces anything. Returns every problem found. */
export function validateHousehold(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['The file does not contain a household.'] };
  if (raw.schema !== undefined && !Number.isInteger(raw.schema)) errors.push('The data version is not a whole number.');
  for (const key of ['people', 'rooms', 'chores', 'events']) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) errors.push(`"${key}" should be a list.`);
  }
  if (!raw.household && !Array.isArray(raw.chores)) errors.push('No household or chores were found in the file.');
  const seen = new Set();
  for (const [i, c] of (Array.isArray(raw.chores) ? raw.chores : []).entries()) {
    if (!c || typeof c !== 'object') { errors.push(`Chore ${i + 1} is not a record.`); continue; }
    if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`Chore ${i + 1} has no name.`);
    if (c.id && seen.has(c.id)) errors.push(`Chore ${i + 1} repeats the id ${c.id}.`);
    seen.add(c.id);
  }
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------------------------------ *
 * Edit helpers. Each returns a new household; the input is never mutated.
 * ------------------------------------------------------------------------ */

const touch = (h, patch) => ({ ...h, ...patch });

export function setHouseholdName(h, name) {
  return touch(h, { household: { ...h.household, name: str(name, 80) || h.household.name } });
}

export function addPerson(h, fields) {
  const person = normalisePerson({ ...fields, id: newId('p') });
  return { household: touch(h, { people: [...h.people, person] }), person };
}

export function updatePerson(h, id, patch) {
  return touch(h, { people: h.people.map((p) => (p.id === id ? normalisePerson({ ...p, ...patch, id }) : p)) });
}

/** Removing a person keeps their history (shown as "a former member") but drops them from eligibility. */
export function removePerson(h, id) {
  return touch(h, {
    people: h.people.filter((p) => p.id !== id),
    chores: h.chores.map((c) => (c.eligible.includes(id) ? { ...c, eligible: c.eligible.filter((x) => x !== id) } : c)),
  });
}

export function addRoom(h, name) {
  const room = normaliseRoom({ name, id: newId('r') });
  return { household: touch(h, { rooms: [...h.rooms, room] }), room };
}

export function renameRoom(h, id, name) {
  return touch(h, { rooms: h.rooms.map((r) => (r.id === id ? { ...r, name: str(name, 40) || r.name } : r)) });
}

/** Chores in a removed room are kept and become "no particular room". */
export function removeRoom(h, id) {
  return touch(h, {
    rooms: h.rooms.filter((r) => r.id !== id),
    chores: h.chores.map((c) => (c.roomId === id ? { ...c, roomId: null } : c)),
  });
}

export function addChore(h, fields, now = nowIso()) {
  const chore = normaliseChore({ ...fields, id: newId('c'), createdAt: now, updatedAt: now }, now);
  return { household: touch(h, { chores: [...h.chores, chore] }), chore };
}

/** Editing a chore never touches its events, so history survives any change. */
export function updateChore(h, id, patch, now = nowIso()) {
  return touch(h, {
    chores: h.chores.map((c) => (c.id === id
      ? normaliseChore({ ...c, ...patch, id, createdAt: c.createdAt, updatedAt: now }, now)
      : c)),
  });
}

/** Deleting a chore removes its definition and its history, and unhooks it from dependencies. */
export function deleteChore(h, id) {
  return touch(h, {
    chores: h.chores.filter((c) => c.id !== id)
      .map((c) => (c.dependsOn.includes(id) ? { ...c, dependsOn: c.dependsOn.filter((x) => x !== id) } : c)),
    events: h.events.filter((e) => e.choreId !== id),
  });
}

export function recordEvent(h, fields, now = new Date()) {
  const event = normaliseEvent({ day: toDay(now), at: now.toISOString(), ...fields, id: newId('e') });
  if (!event.type) throw new Error(`Unknown event type: ${fields.type}`);
  if (!h.chores.some((c) => c.id === event.choreId)) throw new Error('That chore no longer exists.');
  return { household: touch(h, { events: [...h.events, event] }), event };
}

/** Undo: remove one event. */
export function removeEvent(h, eventId) {
  return touch(h, { events: h.events.filter((e) => e.id !== eventId) });
}

export const hasDemo = (h) => h.people.some((p) => p.demo) || h.rooms.some((r) => r.demo) || h.chores.some((c) => c.demo);

/** Remove every example record and the history that belongs to example chores. Real records stay. */
export function removeDemo(h) {
  const demoChores = new Set(h.chores.filter((c) => c.demo).map((c) => c.id));
  const demoPeople = new Set(h.people.filter((p) => p.demo).map((p) => p.id));
  const demoRooms = new Set(h.rooms.filter((r) => r.demo).map((r) => r.id));
  return touch(h, {
    people: h.people.filter((p) => !p.demo),
    rooms: h.rooms.filter((r) => !r.demo),
    chores: h.chores.filter((c) => !c.demo).map((c) => ({
      ...c,
      roomId: demoRooms.has(c.roomId) ? null : c.roomId,
      eligible: c.eligible.filter((x) => !demoPeople.has(x)),
      dependsOn: c.dependsOn.filter((x) => !demoChores.has(x)),
    })),
    events: h.events.filter((e) => !demoChores.has(e.choreId))
      .map((e) => (demoPeople.has(e.by) ? { ...e, by: null } : e)),
  });
}

export const personName = (h, id) => (id ? h.people.find((p) => p.id === id)?.name ?? 'a former member' : 'someone');
export const roomName = (h, id) => (id ? h.rooms.find((r) => r.id === id)?.name ?? 'No particular room' : 'No particular room');
