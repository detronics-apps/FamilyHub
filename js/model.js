// The household model: versioned, plain JSON, edited only through helpers that
// return a new household rather than mutating one. No DOM in here.
//
// Shape (schema 1):
//   { schema, household: {id, name, createdAt},
//     people: [Person], rooms: [Room], chores: [Chore], events: [Event],
//     measurements: [Measurement] }
//
// A Measurement is one dated height and/or weight for a person - a record of
// its own, so entries added on two laptops merge without asking.
//
// A Chore is a *definition* ("Clean basin, weekly"). Each time it is acted on
// an Event is recorded (done / skipped / deferred / rescheduled / dropped).
// The current occurrence is derived from the definition plus its events, never
// stored, so changing a frequency can never erase history.
//
// Personal dashboard preferences are NOT part of this model; see dashboard.js.

import { isDay, toDay, dayDiff, addDays } from './dates.js';

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

// Food details on a person, read by the Meals section (with the 'people:food'
// permission). All optional; a blank means "not said", never a default.
export const ALLERGENS = ['gluten', 'dairy', 'egg', 'nuts', 'peanuts', 'soy', 'fish', 'shellfish', 'sesame'];
export const DIETS = { vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', halal: 'Halal', kosher: 'Kosher', 'no-pork': 'No pork', 'no-beef': 'No beef' };
export const LIFE_STAGES = { pregnant: 'Pregnant', breastfeeding: 'Breastfeeding' };
// What someone would like more chances to eat - a wish, never a diagnosis.
export const FOCUS = {
  protein: 'More protein', iron: 'More iron-rich foods', variety: 'More fruit and vegetable variety',
  colour: 'More colour and plant diversity', fibre: 'More fibre', calcium: 'More calcium-rich foods',
  fats: 'More sources of healthy fats', dense: 'More nourishment in smaller portions',
  selective: 'Easier meals for a selective eater',
};

// A person's own energy goal, in kcal a day against their estimated needs. Only
// for adults who are not pregnant or breastfeeding (energyGoalAllowed).
export const ENERGY_GOALS = { '-500': 'About 500 kcal a day less', '-250': 'About 250 kcal a day less', 0: 'Keep as I am', 250: 'About 250 kcal a day more', 500: 'About 500 kcal a day more' };

// Warm, distinct and readable behind the initials. New colours go at the end so saved choices keep their place.
export const PERSON_COLOURS = ['#d9734e', '#d9a441', '#8fae7e', '#c07aa6', '#d77a7a', '#b58a62', '#6f9fb8', '#9a86c4', '#e39b5e', '#5f9a8b'];

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
    measurements: [],
  };
}

export function normalisePerson(p) {
  return {
    id: str(p.id, 40) || newId('p'),
    name: str(p.name, 40) || 'Someone',
    role: oneOf(p.role, ROLES, 'adult'),
    colour: PERSON_COLOURS.includes(p.colour) ? p.colour : PERSON_COLOURS[0],
    visibility: oneOf(p.visibility, VISIBILITY, 'shared'),
    born: isDay(p.born) ? p.born : '',
    sex: oneOf(p.sex, ['female', 'male'], ''),
    // Pregnancy and breastfeeding are only kept for a female (age is checked by lifeStageAllowed).
    lifeStage: p.sex === 'female' ? oneOf(p.lifeStage, Object.keys(LIFE_STAGES), '') : '',
    // Only kept while pregnant: it gives the weeks, the trimester and the due date.
    conceived: p.sex === 'female' && p.lifeStage === 'pregnant' && isDay(p.conceived) ? p.conceived : '',
    weightKg: (() => { const n = numOrNull(p.weightKg); return n && n <= 400 ? Math.round(n * 10) / 10 : null; })(),
    allergies: pick(p.allergies, ALLERGENS),
    diet: pick(p.diet, Object.keys(DIETS)),
    avoid: words(p.avoid),
    likes: words(p.likes),
    dislikes: words(p.dislikes),
    focus: pick(p.focus, Object.keys(FOCUS)),
    energyGoal: Object.keys(ENERGY_GOALS).includes(String(p.energyGoal)) ? Number(p.energyGoal) : 0,
    goals: str(p.goals, 1000),
    demo: p.demo === true,
  };
}

const pick = (v, allowed) => (Array.isArray(v) ? allowed.filter((x) => v.includes(x)) : []);
/** "kiwi, mushrooms" or a list -> ['kiwi', 'mushrooms'] */
const words = (v) => [...new Set((Array.isArray(v) ? v : String(v ?? '').split(/[,\n]/))
  .map((x) => str(String(x), 40).toLowerCase()).filter(Boolean))].slice(0, 30);

// Stages of life, worked out from the birthday. Without one, the adult/child
// choice on the person's card stands in.
export const STAGES = { baby: 'Baby', toddler: 'Toddler', child: 'Child', teen: 'Teen', adult: 'Adult' };

/** baby under 1, toddler 1-3, child 4-12, teen 13-17, adult 18+; null with no birthday. */
export function stageOf(p, today) {
  const age = ageOn(p.born, today);
  if (age === null) return null;
  return age < 1 ? 'baby' : age < 4 ? 'toddler' : age < 13 ? 'child' : age < 18 ? 'teen' : 'adult';
}

/** Adult or child for everything that asks (chores, "Who are you?"): from the birthday when there is one. */
export function roleOf(p, today) {
  const age = ageOn(p.born, today);
  return age === null ? p.role : age < 18 ? 'child' : 'adult';
}

/** Pregnant or breastfeeding can be chosen for a female aged 16 or more (no birthday: an adult). */
export function lifeStageAllowed(p, today) {
  if (p.sex !== 'female') return false;
  const age = ageOn(p.born, today);
  return age === null ? p.role === 'adult' : age >= 16;
}

/**
 * How far along a pregnancy is, from the conception date. Weeks are counted the
 * way clinics count them (from about two weeks before conception); the due date
 * is 38 weeks after conception. Null when not pregnant or no date was given.
 * `overdue` is set once the due date is two weeks past - time to update the card.
 */
export function pregnancyInfo(p, today) {
  if (p.lifeStage !== 'pregnant' || !isDay(p.conceived) || !isDay(today)) return null;
  const days = dayDiff(p.conceived, today);
  if (days < 0) return null;
  const weeks = Math.floor(days / 7) + 2;
  return { weeks, trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3, due: addDays(p.conceived, 266), overdue: days > 266 + 14 };
}

/** An energy goal is for an adult (18 or more; no birthday: role adult) who is not pregnant or breastfeeding. */
export function energyGoalAllowed(p, today) {
  const age = ageOn(p.born, today);
  if (age === null ? p.role !== 'adult' : age < 18) return false;
  return !(lifeStageAllowed(p, today) && p.lifeStage);
}

/** Whole years on `today`, or null when no birthday was given. */
export function ageOn(born, today) {
  if (!isDay(born) || !isDay(today)) return null;
  const [y, m, d] = born.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.max(0, ty - y - (tm < m || (tm === m && td < d) ? 1 : 0));
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
    // What it uses up (bleach, sponges...), to send to the shopping list.
    supplies: [...new Set((Array.isArray(c.supplies) ? c.supplies : String(c.supplies ?? '').split(/[,\n]/)).map((x) => str(String(x), 80)).filter(Boolean))].slice(0, 30),
    visibility: oneOf(c.visibility, VISIBILITY, 'shared'),
    demo: c.demo === true,
    createdAt: created,
    updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : created,
  };
}

/** One dated height and/or weight. Kept when the person is removed, like their chore history. */
export function normaliseMeasurement(m) {
  const within = (v, lo, hi) => { const n = numOrNull(v); return n !== null && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null; };
  return {
    id: str(m.id, 40) || newId('m'),
    personId: str(m.personId, 40),
    day: isDay(m.day) ? m.day : null,
    weightKg: within(m.weightKg, 0.5, 400),
    heightCm: within(m.heightCm, 20, 250),
    note: str(m.note, 200),
    by: typeof m.by === 'string' ? m.by : null,
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
    minutes: Number.isFinite(e.minutes) && e.minutes > 0 ? Math.round(e.minutes) : null,   // timed: how long it really took
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
  const measurements = list(data.measurements).map(normaliseMeasurement)
    .filter((m) => m.personId && m.day && (m.weightKg !== null || m.heightCm !== null));
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
    measurements,
  };
}

/** Structural check on raw data before it replaces anything. Returns every problem found. */
export function validateHousehold(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['The file does not contain a household.'] };
  if (raw.schema !== undefined && !Number.isInteger(raw.schema)) errors.push('The data version is not a whole number.');
  for (const key of ['people', 'rooms', 'chores', 'events', 'measurements']) {
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

export function addMeasurement(h, fields) {
  const measurement = normaliseMeasurement({ ...fields, id: newId('m') });
  if (!measurement.personId || !measurement.day || (measurement.weightKg === null && measurement.heightCm === null)) {
    throw new Error('A measurement needs a date and a weight or a height.');
  }
  return { household: touch(h, { measurements: [...h.measurements, measurement] }), measurement };
}

export const removeMeasurement = (h, id) => touch(h, { measurements: h.measurements.filter((m) => m.id !== id) });

/** One person's measurements, newest first. */
export const measurementsFor = (h, personId) => (h.measurements ?? [])
  .filter((m) => m.personId === personId).sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id));

/** The latest weight and the latest height, each with its date (they may come from different days). */
export function latestMeasure(h, personId) {
  const list = measurementsFor(h, personId);
  const w = list.find((m) => m.weightKg !== null);
  const t = list.find((m) => m.heightCm !== null);
  return { weightKg: w?.weightKg ?? null, weightDay: w?.day ?? null, heightCm: t?.heightCm ?? null, heightDay: t?.day ?? null };
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
