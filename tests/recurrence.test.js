import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrence, occurrences, blockedBy, category } from '../js/recurrence.js';
import { recordEvent, updateChore, addChore } from '../js/model.js';
import { fixture, TODAY } from './helpers.js';

const at = (day) => new Date(`${day}T12:00:00`);
const occ = (h, id, today = TODAY) => occurrence(h.chores.find((c) => c.id === id), h.events, today);

test('a new chore is ready from its start day, and waiting before it', () => {
  const { h, ids } = fixture();
  assert.equal(occ(h, ids.floor).state, 'ready');
  assert.equal(occ(h, ids.floor, '2026-10-19').state, 'waiting');
});

test('done moves the next turn on by one interval', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'done', by: ann }, at(TODAY)));
  const o = occ(h, ids.floor);
  assert.equal(o.state, 'waiting');
  assert.equal(o.dueDay, '2026-11-01');
  assert.deepEqual(o.lastDone, { day: TODAY, by: ann });
  assert.equal(occ(h, ids.floor, '2026-11-01').state, 'ready');
});

test('changing frequency re-derives next due without losing the last completion', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'done', by: ann }, at(TODAY)));
  h = updateChore(h, ids.floor, { frequency: { unit: 'day', every: 3 } });
  assert.equal(occ(h, ids.floor).dueDay, '2026-10-28');
  assert.equal(occ(h, ids.floor).lastDone.day, TODAY);
});

test('a missed routine stays ONE occurrence - no cascade', () => {
  const { h, ids } = fixture();
  // Daily chore, ready since 20 Oct, never done. Ten days later:
  const all = [...occurrences(h, '2026-10-30').values()];
  assert.equal(all.length, h.chores.length, 'one occurrence per chore, however long it waited');
  const o = occ(h, ids.counters, '2026-10-30');
  assert.equal(o.state, 'ready');
  assert.equal(o.dueDay, '2026-10-20');
  assert.equal(o.waitingDays, 10);
});

test('skipping lets a routine resume its normal cycle', () => {
  let { h, ids } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'skipped' }, at(TODAY)));
  const o = occ(h, ids.floor);
  assert.equal(o.state, 'waiting');
  assert.equal(o.dueDay, '2026-11-01');
  assert.equal(o.lastDone, null, 'a skip is not a completion');
});

test('nothing is put off: old put-offs are ignored, a chore stays until done', () => {
  let { h, ids, ann } = fixture();
  const before = occ(h, ids.floor);
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'deferred', until: '2026-10-27' }, at(TODAY)));
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'rescheduled', until: '2026-10-29' }, at(TODAY)));
  assert.deepEqual([occ(h, ids.floor).dueDay, occ(h, ids.floor).state], [before.dueDay, before.state]);
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'done', by: ann }, at('2026-10-29')));
  assert.equal(occ(h, ids.floor, '2026-10-29').dueDay, '2026-11-05', 'next time counts from when it was done');
});

test('one-off chores stay ready until done or dropped', () => {
  const { h, ids } = fixture();
  assert.equal(occ(h, ids.mystery, '2027-06-01').state, 'ready', 'never quietly moves on');
  assert.equal(occ(h, ids.mystery, '2027-06-01').missedCycles, 0);
  const dropped = recordEvent(h, { choreId: ids.mystery, type: 'dropped' }, at(TODAY)).household;
  assert.equal(occ(dropped, ids.mystery).state, 'closed');
  const done = recordEvent(h, { choreId: ids.mystery, type: 'done' }, at(TODAY)).household;
  assert.equal(occ(done, ids.mystery).state, 'closed');
});

test('two whole cycles waiting asks for a review', () => {
  const { h, ids } = fixture();
  assert.equal(occ(h, ids.floor).needsReview, false);
  // Weekly chore ready since 20 Oct: two whole weeks later it asks too, not before.
  const fresh = fixture();
  assert.equal(occ(fresh.h, fresh.ids.basin, '2026-11-03').needsReview, true);
  assert.equal(occ(fresh.h, fresh.ids.basin, '2026-11-02').needsReview, false);
});

test('categories', () => {
  const { h, ids } = fixture();
  const c = (id) => category(h.chores.find((x) => x.id === id));
  assert.equal(c(ids.basin), 'important');
  assert.equal(c(ids.floor), 'routine');
  assert.equal(category({ ...h.chores[0], kind: 'improvement' }), 'optional');
  assert.equal(category({ ...h.chores[0], optional: true }), 'optional');
});

test('completing one room item does not complete the others', () => {
  let { h, ids, ann, kitchen } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  const map = occurrences(h, TODAY);
  assert.equal(map.get(ids.counters).state, 'waiting');
  for (const c of h.chores.filter((x) => x.roomId === kitchen && x.id !== ids.counters)) {
    assert.equal(map.get(c.id).state, 'ready', c.name);
  }
});

test('dependencies block until the earlier chore is done', () => {
  let { h, ids, ann } = fixture();
  h = updateChore(h, ids.floor, { dependsOn: [ids.counters] });
  const floor = () => h.chores.find((c) => c.id === ids.floor);
  assert.equal(blockedBy(floor(), h, occurrences(h, TODAY)).length, 1);
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  assert.equal(blockedBy(floor(), h, occurrences(h, TODAY)).length, 0);
  // A one-off dependency in the future still blocks: it is not done yet.
  let dep;
  ({ household: h, chore: dep } = addChore(h, { name: 'Buy mop', frequency: { unit: 'once' }, startDay: '2026-11-10' }));
  h = updateChore(h, ids.floor, { dependsOn: [dep.id] });
  assert.equal(blockedBy(floor(), h, occurrences(h, TODAY)).length, 1);
});
