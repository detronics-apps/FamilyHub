import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_TILES, defaultPrefs, resolveDashboard, moveModule, hideModule, showModule, normalisePrefs } from '../js/dashboard.js';
import { STARTERS } from '../js/apps/catalogue.js';

const ids = (list) => list.map((m) => m.id);
const apps = ['chores', 'tasks', 'tickets', 'finance'].map((id) => ({ id, name: id, purpose: '', status: 'ready' }));
const MODS = [...apps, ...CORE_TILES];

test('default shows every installed app, then the core tiles', () => {
  const { visible, hidden } = resolveDashboard(defaultPrefs(), MODS);
  assert.deepEqual(ids(visible), ['chores', 'tasks', 'tickets', 'finance', 'people', 'library', 'settings']);
  assert.deepEqual(hidden, []);
});

test('every starter app has a valid manifest', () => {
  assert.ok(STARTERS.length >= 1);
  assert.ok(STARTERS.some((s) => s.manifest.id === 'chores'));
});

test('reorder, hide and restore', () => {
  let p = defaultPrefs();
  p = moveModule(p, 'tickets', -1, MODS);
  assert.deepEqual(ids(resolveDashboard(p, MODS).visible).slice(0, 3), ['chores', 'tickets', 'tasks']);
  p = moveModule(p, 'chores', -1, MODS);      // already first: nothing moves
  assert.equal(ids(resolveDashboard(p, MODS).visible)[0], 'chores');
  p = hideModule(p, 'finance', MODS);
  assert.ok(!ids(resolveDashboard(p, MODS).visible).includes('finance'));
  assert.deepEqual(ids(resolveDashboard(p, MODS).hidden), ['finance']);
  p = showModule(p, 'finance', MODS);
  assert.equal(ids(resolveDashboard(p, MODS).visible).at(-1), 'finance', 'comes back at the end');
  assert.deepEqual(resolveDashboard(p, MODS).hidden, []);
});

test('moving skips over hidden tiles', () => {
  let p = hideModule(defaultPrefs(), 'tasks', MODS);
  p = moveModule(p, 'tickets', -1, MODS);
  assert.deepEqual(ids(resolveDashboard(p, MODS).visible).slice(0, 2), ['tickets', 'chores']);
});

test('settings and mini-apps can never be hidden - they are the way back', () => {
  let p = hideModule(defaultPrefs(), 'settings', MODS);
  p = hideModule(p, 'library', MODS);
  assert.ok(ids(resolveDashboard(p, MODS).visible).includes('settings'));
  assert.ok(ids(resolveDashboard(p, MODS).visible).includes('library'));
});

test('an uninstalled app disappears; a newly installed one appears at the end', () => {
  const p = moveModule(defaultPrefs(), 'finance', -1, MODS);
  const without = MODS.filter((m) => m.id !== 'finance');
  assert.ok(!ids(resolveDashboard(p, without).visible).includes('finance'));
  const withNew = [...MODS, { id: 'com.example.notes', name: 'Notes' }];
  assert.equal(ids(resolveDashboard(p, withNew).visible).at(-1), 'com.example.notes');
});

test('stale or hostile preferences are repaired', () => {
  const p = normalisePrefs({ order: ['tasks', 'tasks', 'unknown', 42], hidden: ['ghost', 'tasks', 'tasks'] }, MODS);
  assert.equal(p.order[0], 'tasks');
  assert.equal(p.order.length, MODS.length, 'missing tiles appended');
  assert.deepEqual(p.hidden, ['tasks']);
  assert.deepEqual(normalisePrefs(null, MODS).order, ids(MODS));
});
