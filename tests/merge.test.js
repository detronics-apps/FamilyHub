import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecord3, mergeList3, mergeHousehold, resolveConflicts, conflictKey } from '../js/merge.js';
import { recordEvent, updateChore, removeEvent, deleteChore, setHouseholdName } from '../js/model.js';
import { fixture, TODAY } from './helpers.js';

const at = (day, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);

test('record: each side changing a different field keeps both', () => {
  const base = { id: 'a', name: 'Floor', minutes: 10, effort: 'low' };
  const r = mergeRecord3(base, { ...base, minutes: 15 }, { ...base, effort: 'high' });
  assert.deepEqual(r.merged, { id: 'a', name: 'Floor', minutes: 15, effort: 'high' });
  assert.deepEqual(r.conflicts, []);
});

test('record: the same field changed differently is a conflict (never last-write-wins)', () => {
  const base = { id: 'a', name: 'Floor', minutes: 10 };
  const r = mergeRecord3(base, { ...base, minutes: 15 }, { ...base, minutes: 20 });
  assert.deepEqual(r.conflicts, [{ field: 'minutes', mine: 15, theirs: 20 }]);
  assert.equal(r.merged.minutes, 15, 'mine holds until a person decides');
});

test('record: bookkeeping fields never ask a person', () => {
  const base = { id: 'a', name: 'x', updatedAt: '1', rev: 1 };
  const r = mergeRecord3(base, { ...base, name: 'y', updatedAt: '3', rev: 2 }, { ...base, updatedAt: '2', rev: 2 });
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.merged.updatedAt, '3');
});

test('list: adds on both sides kept; untouched deletes applied; edit vs delete asks', () => {
  const base = [{ id: '1', v: 1 }, { id: '2', v: 2 }, { id: '3', v: 3 }];
  const mine = [{ id: '1', v: 1 }, { id: '3', v: 30 }, { id: 'm', v: 0 }];      // deleted 2, edited 3, added m
  const theirs = [{ id: '2', v: 2 }, { id: '1', v: 1 }, { id: 't', v: 0 }];     // deleted 3, added t
  const r = mergeList3(base, mine, theirs);
  assert.deepEqual(r.list.map((x) => x.id).sort(), ['1', '3', 'm', 't']);
  assert.deepEqual(r.conflicts.map((c) => [c.id, c.kind]), [['3', 'edit-delete']]);
});

test('household: completions on two laptops are both kept', () => {
  const { h: base, ids, ann } = fixture();
  const mine = recordEvent(base, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY, 9)).household;
  const theirs = recordEvent(base, { choreId: ids.basin, type: 'done', by: ann }, at(TODAY, 10)).household;
  const { household, conflicts } = mergeHousehold(base, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.equal(household.events.length, 2);
  assert.ok(household.events[0].at < household.events[1].at, 'in time order');
});

test('household: an undo on one side survives the merge', () => {
  const { h, ids, ann } = fixture();
  const { household: base, event } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY));
  const mine = removeEvent(base, event.id);
  const theirs = setHouseholdName(base, 'Renamed');
  const { household, conflicts } = mergeHousehold(base, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.equal(household.events.length, 0);
  assert.equal(household.household.name, 'Renamed');
});

test('household: same chore field edited on both sides asks, and the choice is applied', () => {
  const { h: base, ids } = fixture();
  const mine = updateChore(base, ids.floor, { minutes: 20 }, '2026-10-25T10:00:00.000Z');
  const theirs = updateChore(base, ids.floor, { minutes: 30, effort: 'high' }, '2026-10-25T11:00:00.000Z');
  const { household, conflicts } = mergeHousehold(base, mine, theirs);
  assert.deepEqual(conflicts.map((c) => [c.collection, c.field, c.mine, c.theirs]), [['chores', 'minutes', 20, 30]]);
  const floor = (x) => x.chores.find((c) => c.id === ids.floor);
  assert.equal(floor(household).effort, 'high', 'the other change came through');
  assert.equal(floor(resolveConflicts(household, conflicts, {})).minutes, 20, 'unanswered keeps mine');
  assert.equal(floor(resolveConflicts(household, conflicts, { [conflictKey(conflicts[0])]: 'theirs' })).minutes, 30);
});

test('household: deleting a chore on one laptop while the other edits it asks', () => {
  const { h: base, ids } = fixture();
  const mine = deleteChore(base, ids.oven);
  const theirs = updateChore(base, ids.oven, { name: 'Oven, properly' });
  const { conflicts } = mergeHousehold(base, mine, theirs);
  assert.deepEqual(conflicts.map((c) => [c.collection, c.id, c.kind]), [['chores', ids.oven, 'edit-delete']]);
});

test('two-way (no base): everything new on both sides is kept', () => {
  const { h, ids, ann } = fixture();
  const mine = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY, 9)).household;
  const theirs = recordEvent(h, { choreId: ids.basin, type: 'done', by: ann }, at(TODAY, 10)).household;
  const { household, conflicts } = mergeHousehold(null, mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.equal(household.events.length, 2);
});

test('D-082 mini-app records from two phones: items from both kept, removals kept, a real clash reported', async () => {
  const { mergeDeep3 } = await import('../js/merge.js');
  const item = (id, name, qty = 1) => ({ id, name, qty, checked: false });
  const base = { id: 'l', rev: 5, title: 'Groceries', tags: ['week'], items: [item('a', 'eggs'), item('b', 'rice')] };
  const me = { ...base, rev: 6, items: [item('a', 'eggs'), item('b', 'rice'), item('c', 'milk')] };
  const wife = { ...base, rev: 6, tags: ['week', 'braai'], items: [item('a', 'eggs', 12), item('d', 'bread')] };   // rice bought and removed
  const r = mergeDeep3(base, me, wife);
  assert.deepEqual(r.merged.items.map((i) => `${i.name}${i.qty}`), ['eggs12', 'milk1', 'bread1']);
  assert.deepEqual(r.merged.tags, ['week', 'braai']);
  assert.deepEqual(r.conflicts, []);
  const clash = mergeDeep3(base, { ...base, items: [item('a', 'eggs', 6), base.items[1]] }, { ...base, items: [item('a', 'eggs', 12), base.items[1]] });
  assert.deepEqual(clash.conflicts.map((c) => [c.path.join('.'), c.mine, c.theirs]), [['items.a.qty', 6, 12]]);
});
