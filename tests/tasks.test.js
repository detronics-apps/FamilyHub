import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTask, taskSummary, sortTasks, dueText, waitingOn, projectProgress, setStatus, toggleChecklist, addChecklistItem, FILTERS } from '../js/apps/tasks/logic.js';
import { createCollection } from '../js/collections.js';
import { createMemoryStore } from '../js/folder-store.js';
import { fmtDay } from '../js/dates.js';

test('a task needs only a title; everything else defaults', () => {
  const t = normaliseTask({ title: '  Fix the gate ' });
  assert.equal(t.title, 'Fix the gate');
  assert.equal(t.kind, 'task');
  assert.equal(t.status, 'open');
  assert.equal(t.due, null);
  assert.deepEqual(t.checklist, []);
  assert.equal(normaliseTask({ status: 'weird', due: 'tomorrow', minutes: -3 }).status, 'open');
  assert.equal(normaliseTask({ due: 'tomorrow' }).due, null);
  assert.equal(normaliseTask({ minutes: -3 }).minutes, null);
});

test('a passed planned day is described neutrally - no overdue counter', () => {
  assert.equal(dueText('2026-10-20', '2026-10-25', fmtDay), 'planned for Tue 20 Oct');
  assert.equal(dueText('2026-10-26', '2026-10-25', fmtDay), 'tomorrow');
  assert.equal(dueText(null, '2026-10-25', fmtDay), 'no set day');
});

test('ordering: open first, planned soonest, then newest', () => {
  const list = [
    { id: 'a', status: 'done', due: '2026-10-01', updatedAt: '9' },
    { id: 'b', status: 'open', due: null, updatedAt: '5' },
    { id: 'c', status: 'open', due: '2026-11-01', updatedAt: '1' },
    { id: 'd', status: 'doing', due: '2026-10-28', updatedAt: '2' },
  ];
  assert.deepEqual(list.sort(sortTasks).map((x) => x.id), ['d', 'c', 'b', 'a']);
});

test('done records who and when; reopening clears it', () => {
  const t = normaliseTask({ title: 'x' });
  const done = setStatus(t, 'done', { by: 'p1', now: '2026-10-25T10:00:00Z' });
  assert.equal(done.completedBy, 'p1');
  assert.equal(setStatus(done, 'open').completedAt, null);
  assert.throws(() => setStatus(t, 'finished'), /Unknown status/);
});

test('checklists: add, tick, and count in the summary', () => {
  let t = normaliseTask({ title: 'Paint the fence' });
  t = addChecklistItem(t, 'Buy paint', 'a');
  t = addChecklistItem(t, '  ', 'b');
  t = addChecklistItem(t, 'Sand', 'c');
  t = toggleChecklist(t, 'a');
  const s = taskSummary(t);
  assert.equal(s.checklistTotal, 2);
  assert.equal(s.checklistDone, 1);
});

test('dependencies and project progress', () => {
  const all = [
    { id: 'p', kind: 'project', status: 'open', dependsOn: [] },
    { id: 'buy', parentId: 'p', status: 'done', dependsOn: [] },
    { id: 'paint', parentId: 'p', status: 'open', dependsOn: ['buy', 'sand'] },
    { id: 'sand', parentId: 'p', status: 'open', dependsOn: [] },
    { id: 'skip', parentId: 'p', status: 'dropped', dependsOn: [] },
  ];
  assert.deepEqual(waitingOn(all[2], all).map((x) => x.id), ['sand']);
  assert.deepEqual(projectProgress('p', all), { done: 1, total: 3 });
});

test('filters', () => {
  const s = taskSummary(normaliseTask({ title: 'x', assignees: ['p1'] }));
  assert.ok(FILTERS.open(s));
  assert.ok(FILTERS.mine(s, 'p1'));
  assert.ok(!FILTERS.mine(s, 'p2'));
  assert.ok(FILTERS.projects(taskSummary(normaliseTask({ title: 'p', kind: 'project' }))));
});

test('stored through a collection: the list needs only the index', async () => {
  const store = createMemoryStore();
  const col = createCollection(store, { app: 'tasks', name: 'tasks', summary: taskSummary, text: (t) => t.title });
  const saved = await col.put(normaliseTask({ title: 'Book the plumber', checklist: [{ text: 'Find number' }] }));
  store.stats.reads = 0;
  const fresh = createCollection(store, { app: 'tasks', name: 'tasks', summary: taskSummary });
  const { items } = await fresh.list();
  assert.equal(items[0].checklistTotal, 1);
  assert.equal(store.stats.reads, 1);
  assert.equal((await fresh.get(saved.id)).checklist[0].text, 'Find number');
});
