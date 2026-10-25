import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, defaultPrefs, resolveDashboard, moveModule, hideModule, showModule, normalisePrefs } from '../js/dashboard.js';

const ids = (list) => list.map((m) => m.id);

test('default shows every module in the brief order, Chores first', () => {
  const { visible, hidden } = resolveDashboard(defaultPrefs());
  assert.equal(visible.length, MODULES.length);
  assert.equal(visible[0].id, 'chores');
  assert.deepEqual(hidden, []);
});

test('only Chores and Settings claim to work; everything else says it is planned', () => {
  assert.deepEqual(MODULES.filter((m) => m.status === 'ready').map((m) => m.id), ['chores', 'settings']);
  assert.ok(MODULES.every((m) => ['ready', 'planned'].includes(m.status)));
});

test('reorder, hide and restore', () => {
  let p = defaultPrefs();
  p = moveModule(p, 'tickets', -1);
  assert.deepEqual(ids(resolveDashboard(p).visible).slice(0, 3), ['chores', 'tickets', 'tasks']);
  p = moveModule(p, 'chores', -1);      // already first: nothing moves
  assert.equal(ids(resolveDashboard(p).visible)[0], 'chores');
  p = hideModule(p, 'finance');
  assert.ok(!ids(resolveDashboard(p).visible).includes('finance'));
  assert.deepEqual(ids(resolveDashboard(p).hidden), ['finance']);
  p = showModule(p, 'finance');
  assert.equal(ids(resolveDashboard(p).visible).at(-1), 'finance', 'comes back at the end');
  assert.deepEqual(resolveDashboard(p).hidden, []);
});

test('moving skips over hidden modules', () => {
  let p = hideModule(defaultPrefs(), 'tasks');
  p = moveModule(p, 'tickets', -1);
  assert.deepEqual(ids(resolveDashboard(p).visible).slice(0, 2), ['tickets', 'chores']);
});

test('settings can never be hidden - it is the way back', () => {
  const p = hideModule(defaultPrefs(), 'settings');
  assert.ok(ids(resolveDashboard(p).visible).includes('settings'));
});

test('stale or hostile preferences are repaired', () => {
  const p = normalisePrefs({ order: ['meals', 'meals', 'unknown', 42], hidden: ['ghost', 'meals', 'meals'] });
  assert.equal(p.order[0], 'meals');
  assert.equal(p.order.length, MODULES.length, 'missing modules appended');
  assert.deepEqual(p.hidden, ['meals']);
  assert.deepEqual(normalisePrefs(null), defaultPrefs());
});
