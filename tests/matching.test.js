import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTasks, momentum, eligible } from '../js/matching.js';
import { recordEvent, updateChore } from '../js/model.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, TODAY } from './helpers.js';

const at = (day) => new Date(`${day}T12:00:00`);
const names = (list) => list.map((t) => t.chore.name);

test('a five-minute filter never suggests a chore known to take longer', () => {
  const { h } = fixture();
  const list = findTasks(h, { minutes: 5 }, TODAY);
  assert.ok(list.length > 0);
  for (const t of list) assert.ok(t.chore.minutes == null || t.chore.minutes <= 5, t.chore.name);
  // ...unless the person explicitly allows an overrun.
  const over = findTasks(h, { minutes: 5, allowOverrun: true }, TODAY);
  assert.ok(over.some((t) => t.chore.minutes > 5));
  assert.ok(over.find((t) => t.chore.minutes > 5).reasons.includes('Longer than your time'));
});

test('unestimated chores are still offered, and labelled as such', () => {
  const { h } = fixture();
  const garage = findTasks(h, { minutes: 5 }, TODAY).find((t) => t.chore.name === 'Sort the garage');
  assert.ok(garage);
  assert.ok(garage.reasons.includes('Time not estimated'));
});

test('low energy leaves out high-effort chores (and medium)', () => {
  const { h } = fixture();
  const list = findTasks(h, { energy: 'low' }, TODAY);
  assert.ok(!names(list).includes('Clean oven'));
  assert.ok(!names(list).includes('Kitchen floor'));
  assert.ok(names(list).includes('Wipe counters'));
  assert.ok(names(findTasks(h, { energy: 'high' }, TODAY)).includes('Clean oven'));
});

test('"any room" includes every room and no-room chores; a room filter restricts', () => {
  const { h, kitchen, bathroom } = fixture();
  const any = findTasks(h, { roomId: 'any' }, TODAY);
  const rooms = new Set(any.map((t) => t.chore.roomId));
  assert.ok(rooms.has(kitchen) && rooms.has(bathroom) && rooms.has(null));
  const onlyKitchen = findTasks(h, { roomId: kitchen }, TODAY);
  assert.ok(onlyKitchen.length > 0);
  assert.ok(onlyKitchen.every((t) => t.chore.roomId === kitchen));
});

test('"anywhere but the bathroom"', () => {
  const { h, bathroom } = fixture();
  const list = findTasks(h, { roomId: 'any', avoidRooms: [bathroom] }, TODAY);
  assert.ok(list.length > 0);
  assert.ok(list.every((t) => t.chore.roomId !== bathroom));
});

test('a child sees only chores they are named on; adults see unassigned ones', () => {
  const { h, kid, ann, ids } = fixture();
  assert.deepEqual(names(findTasks(h, { personId: kid }, TODAY)), ['Empty bin']);
  const adult = names(findTasks(h, { personId: ann }, TODAY));
  assert.ok(adult.includes('Empty bin') && adult.includes('Clean oven'));
  const named = updateChore(h, ids.oven, { eligible: [kid] });
  assert.ok(!names(findTasks(named, { personId: ann }, TODAY)).includes('Clean oven'));
  assert.equal(eligible(h.chores[0], null), true, 'nobody chosen: everything');
});

test('completing a chore updates suggestions straight away', () => {
  let { h, ids, ann } = fixture();
  assert.ok(names(findTasks(h, {}, TODAY)).includes('Wipe counters'));
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  assert.ok(!names(findTasks(h, {}, TODAY)).includes('Wipe counters'));
  assert.ok(names(findTasks(h, {}, '2026-10-26')).includes('Wipe counters'), 'back tomorrow');
});

test('not-yet-due chores are left out unless asked for; optional ones are offered last', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'done', by: ann }, at(TODAY)));
  assert.ok(!names(findTasks(h, {}, TODAY)).includes('Kitchen floor'));
  assert.ok(names(findTasks(h, { includeNotDue: true }, TODAY)).includes('Kitchen floor'));
  h = updateChore(h, ids.floor, { kind: 'improvement' });
  const list = findTasks(h, {}, TODAY);
  assert.equal(list.at(-1).chore.name, 'Kitchen floor');
  assert.ok(list.at(-1).reasons.includes('Optional improvement'));
});

test('ordering: important first, then longest-waiting for its own cycle, then quickest', () => {
  const { h } = fixture();
  const list = names(findTasks(h, {}, TODAY));
  assert.equal(list[0], 'Clean basin', 'the important one');
  // Daily counters have waited 5 cycles; weekly floor less than one.
  assert.ok(list.indexOf('Wipe counters') < list.indexOf('Kitchen floor'));
});

test('blocked chores are not suggested', () => {
  let { h, ids } = fixture();
  h = updateChore(h, ids.floor, { dependsOn: [ids.counters] });
  assert.ok(!names(findTasks(h, {}, TODAY)).includes('Kitchen floor'));
});

test('momentum offers up to three distinct, labelled options, never the one just done', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  const picks = momentum(h, {}, TODAY, ids.counters);
  assert.ok(picks.length >= 2 && picks.length <= 3);
  assert.equal(new Set(picks.map((p) => p.chore.id)).size, picks.length);
  assert.ok(picks.every((p) => p.chore.id !== ids.counters && p.label));
  assert.ok(picks.some((p) => p.label === 'While you are in there'), 'a same-room option');
  assert.equal(picks.find((p) => p.label === 'While you are in there').chore.roomId, h.chores.find((c) => c.id === ids.counters).roomId);
});

test('momentum respects the filters the person already chose', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  for (const p of momentum(h, { minutes: 5, energy: 'low' }, TODAY, ids.counters)) {
    assert.ok((p.chore.minutes ?? 0) <= 5);
    assert.ok(p.chore.effort !== 'high' && p.chore.effort !== 'medium');
  }
});

test('the example household: five minutes and low energy finds something, and asks no one to do the oven', () => {
  const demo = demoHousehold(TODAY);
  const list = findTasks(demo, { minutes: 5, energy: 'low' }, TODAY);
  assert.ok(list.length >= 2);
  assert.ok(!names(list).includes('Clean the oven'));
  assert.ok(!names(list).includes('Vacuum the living room'), 'waits for the toys');
});
