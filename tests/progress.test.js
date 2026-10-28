import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { householdProgress, activity } from '../js/progress.js';
import { recordEvent } from '../js/model.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, TODAY } from './helpers.js';

const at = (day) => new Date(`${day}T12:00:00`);

test('counts what was done this week and what is ready, by room', () => {
  let { h, ids, ann, kitchen } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  ({ household: h } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at('2026-10-10')));   // too long ago
  const p = householdProgress(h, TODAY);
  assert.equal(p.doneCount, 1);
  assert.equal(p.rooms.find((r) => r.roomId === kitchen).done, 1);
  assert.ok(p.readyCount > 0);
});

test('progress carries no per-person figures', () => {
  const p = householdProgress(demoHousehold(TODAY), TODAY);
  const text = JSON.stringify(p);
  for (const id of ['p_demo_alex', 'p_demo_sam', 'p_demo_mia']) assert.ok(!text.includes(id), id);
  // And the module has no way to make one: it never groups by `by`.
  assert.ok(!/\.by\b/.test(readFileSync(new URL('../js/progress.js', import.meta.url), 'utf8').split('export function activity')[0]));
});

test('the example household asks for exactly one review - the oven', () => {
  const p = householdProgress(demoHousehold(TODAY), TODAY);
  assert.deepEqual(p.review.map((c) => c.name), ['Clean the oven']);
});

test('activity is newest first and names who did it', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at('2026-10-20')));
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'skipped' }, at(TODAY)));
  const list = activity(h);
  assert.equal(list[0].what, 'Kitchen floor');
  assert.equal(list[0].action, 'Skipped this time');
  assert.equal(list[1].who, 'Ann');
});

test('weekly load: minutes a week and a day, how often each comes round, the unknowns counted', async () => {
  const { weeklyLoad, fmtMinutes } = await import('../js/progress.js');
  const h = {
    rooms: [{ id: 'r1', name: 'Kitchen' }], events: [],
    chores: [
      { id: 'a', roomId: 'r1', minutes: 10, frequency: { unit: 'day', every: 1 } },     // 70 a week
      { id: 'b', roomId: null, minutes: 30, frequency: { unit: 'week', every: 2 } },    // 15
      { id: 'c', roomId: null, minutes: 52, frequency: { unit: 'month', every: 1 } },   // 12
      { id: 'd', roomId: null, minutes: 60, frequency: { unit: 'once', every: 1 } },    // left out
      { id: 'e', roomId: null, minutes: null, frequency: { unit: 'week', every: 1 } },  // unknown
      { id: 'f', roomId: null, minutes: 14, frequency: { unit: 'week', every: 1 }, optional: true },
    ],
  };
  const w = weeklyLoad(h);
  assert.equal(Math.round(w.week), 97); assert.equal(Math.round(w.day), 14);
  assert.equal(w.unknown, 1); assert.equal(w.optional, 14);
  assert.equal(w.rooms[0].room, 'Kitchen');
  assert.equal(fmtMinutes(85), '1 h 25 min'); assert.equal(fmtMinutes(40), '40 min');
});

test('three timed Dones over the plan suggest their average', async () => {
  const { timeSuggestions } = await import('../js/progress.js');
  const chore = { id: 'trash', name: 'Take out the trash', minutes: 5 };
  const runs = (...m) => ({ chores: [chore], events: m.map((minutes) => ({ choreId: 'trash', type: 'done', minutes })) });
  assert.deepEqual(timeSuggestions(runs(7, 10)), [], 'two is not yet a pattern');
  assert.equal(timeSuggestions(runs(7, 10, 7))[0].minutes, 8);
  assert.deepEqual(timeSuggestions(runs(7, 10, 4)), [], 'the last one was within the plan');
  assert.equal(timeSuggestions(runs(3, 4, 7, 10, 7, 9))[0].minutes, 7, 'the last five runs');
  assert.equal(timeSuggestions({ chores: [{ ...chore, minutes: 8 }], events: runs(7, 10, 7).events }).length, 0, 'once raised, it stops asking');
  assert.equal(timeSuggestions({ chores: [{ ...chore, minutes: null }], events: runs(7, 10, 7).events })[0].minutes, 8, 'no time set yet');
});
