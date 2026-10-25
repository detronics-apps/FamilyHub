import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrate, validateHousehold, updateChore, deleteChore, recordEvent, removeEvent, removePerson,
  removeRoom, removeDemo, hasDemo, normaliseChore, SCHEMA_VERSION, personName,
} from '../js/model.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, TODAY } from './helpers.js';

const at = (day) => new Date(`${day}T12:00:00`);

test('helpers never mutate the household they are given', () => {
  const { h, ids, ann } = fixture();
  const before = JSON.stringify(h);
  updateChore(h, ids.oven, { name: 'X' });
  recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at(TODAY));
  deleteChore(h, ids.oven);
  removePerson(h, ann);
  assert.equal(JSON.stringify(h), before);
});

test('a chore needs only a name; everything else has a sensible default', () => {
  const c = normaliseChore({ name: '  Water plants  ' }, '2026-10-01T09:00:00.000Z');
  assert.equal(c.name, 'Water plants');
  assert.deepEqual(c.frequency, { unit: 'week', every: 1 });
  assert.equal(c.kind, 'routine');
  assert.equal(c.minutes, null);
  assert.equal(c.effort, null);
  assert.equal(c.importance, 'normal');
  assert.equal(c.visibility, 'shared');
  assert.deepEqual(c.eligible, []);
  assert.equal(normaliseChore({ name: 'x', frequency: { unit: 'once' } }).kind, 'oneoff');
});

test('create, edit, delete a chore definition', () => {
  const { h, ids } = fixture();
  const edited = updateChore(h, ids.floor, { name: 'Mop floor', minutes: 20 });
  const c = edited.chores.find((x) => x.id === ids.floor);
  assert.equal(c.name, 'Mop floor');
  assert.equal(c.minutes, 20);
  assert.equal(c.createdAt, h.chores.find((x) => x.id === ids.floor).createdAt);
  const gone = deleteChore(edited, ids.floor);
  assert.equal(gone.chores.some((x) => x.id === ids.floor), false);
});

test('changing frequency keeps history', () => {
  const { h, ids, ann } = fixture();
  const { household } = recordEvent(h, { choreId: ids.floor, type: 'done', by: ann }, at('2026-10-21'));
  const changed = updateChore(household, ids.floor, { frequency: { unit: 'month', every: 1 } });
  assert.equal(changed.events.filter((e) => e.choreId === ids.floor).length, 1);
});

test('deleting a chore removes its history and unhooks dependants', () => {
  let { h, ids, ann } = fixture();
  h = updateChore(h, ids.floor, { dependsOn: [ids.counters] });
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  h = deleteChore(h, ids.counters);
  assert.equal(h.events.length, 0);
  assert.deepEqual(h.chores.find((c) => c.id === ids.floor).dependsOn, []);
});

test('recordEvent refuses unknown types and missing chores; removeEvent undoes', () => {
  const { h, ids, ann } = fixture();
  assert.throws(() => recordEvent(h, { choreId: ids.oven, type: 'finished' }), /Unknown event type/);
  assert.throws(() => recordEvent(h, { choreId: 'c_nope', type: 'done' }), /no longer exists/);
  const { household, event } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at(TODAY));
  assert.equal(event.day, TODAY);
  assert.equal(event.by, ann);
  assert.equal(removeEvent(household, event.id).events.length, 0);
});

test('removing a person keeps their history but drops them from who-can-do-it', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.bin, type: 'done', by: ann }, at(TODAY)));
  h = removePerson(h, ann);
  assert.equal(h.events.length, 1);
  assert.equal(personName(h, ann), 'a former member');
  assert.equal(h.chores.find((c) => c.id === ids.bin).eligible.includes(ann), false);
});

test('removing a room keeps its chores', () => {
  const { h, kitchen } = fixture();
  const after = removeRoom(h, kitchen);
  assert.equal(after.chores.length, h.chores.length);
  assert.ok(after.chores.every((c) => c.roomId !== kitchen));
});

test('removing the example family leaves real records alone', () => {
  const demo = demoHousehold(TODAY);
  assert.ok(hasDemo(demo));
  const { household: mixed } = recordEvent(
    { ...demo, chores: [...demo.chores, normaliseChore({ id: 'c_mine', name: 'My own chore', roomId: 'r_demo_kitchen', eligible: ['p_demo_alex'] })] },
    { choreId: 'c_mine', type: 'done', by: 'p_demo_alex' }, at(TODAY),
  );
  const clean = removeDemo(mixed);
  assert.equal(hasDemo(clean), false);
  assert.deepEqual(clean.chores.map((c) => c.id), ['c_mine']);
  assert.equal(clean.chores[0].roomId, null);
  assert.deepEqual(clean.chores[0].eligible, []);
  assert.equal(clean.events.length, 1, 'my own history stays');
  assert.equal(clean.events[0].by, null);
});

test('migrates a literal unversioned (v0) household with missing fields', () => {
  // Written by hand to look like data saved before `schema` existed.
  const old = {
    household: { name: 'Old family' },
    people: [{ id: 'p1', name: 'Pat' }],
    rooms: [{ id: 'r1', name: 'Kitchen' }],
    chores: [{ id: 'c1', name: 'Dishes', roomId: 'r1', frequency: { unit: 'day' } },
      { id: 'c2', name: 'Lost room', roomId: 'r_missing' }],
    events: [{ id: 'e1', choreId: 'c1', type: 'done', day: '2026-10-01' }, { choreId: 'c1', type: 'bogus', day: '2026-10-02' }],
  };
  const h = migrate(old);
  assert.equal(h.schema, SCHEMA_VERSION);
  assert.equal(h.household.name, 'Old family');
  assert.equal(h.people[0].role, 'adult');
  assert.deepEqual(h.chores[0].frequency, { unit: 'day', every: 1 });
  assert.equal(h.chores[0].visibility, 'shared');
  assert.equal(h.chores[1].roomId, null, 'a reference to a missing room is repaired');
  assert.equal(h.events.length, 1, 'an event of unknown type is dropped');
});

test('refuses data from a newer version, and garbage', () => {
  assert.throws(() => migrate({ schema: SCHEMA_VERSION + 1 }), /newer version/);
  assert.throws(() => migrate(null), /not a Family Hub/);
  assert.throws(() => migrate([1, 2]), /not a Family Hub/);
});

test('validation reports every problem', () => {
  assert.equal(validateHousehold(fixture().h).ok, true);
  const bad = validateHousehold({ chores: [{ id: 'a', name: '' }, { id: 'a', name: 'x' }, 7], people: 'nope' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /people/.test(e)));
  assert.ok(bad.errors.some((e) => /no name/.test(e)));
  assert.ok(bad.errors.some((e) => /repeats/.test(e)));
  assert.ok(bad.errors.some((e) => /not a record/.test(e)));
});
