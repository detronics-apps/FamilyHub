import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore, exportData, parseImport, exportFilename, KEYS, EXPORT_KIND, normaliseDevice } from '../js/storage.js';
import { recordEvent } from '../js/model.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, memoryStorage, TODAY } from './helpers.js';

test('first visit: nothing saved is not an error', () => {
  const store = createLocalStore(memoryStorage());
  assert.deepEqual(store.loadHousehold(), { ok: true, household: null });
});

test('save, reload, and records survive', () => {
  const backing = memoryStorage();
  const { h, ids, ann } = fixture();
  const { household } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, new Date(`${TODAY}T12:00:00`));
  assert.equal(createLocalStore(backing).saveHousehold(household).ok, true);
  const again = createLocalStore(backing).loadHousehold();   // a fresh store, as after a refresh
  assert.equal(again.ok, true);
  assert.deepEqual(again.household, household);
});

test('a damaged save is reported, and the previous good copy can be restored', () => {
  const backing = memoryStorage();
  const store = createLocalStore(backing);
  const { h } = fixture();
  store.saveHousehold(h);
  store.saveHousehold({ ...h, household: { ...h.household, name: 'Second' } });
  backing.setItem(KEYS.household, '{"broken":');
  const loaded = store.loadHousehold();
  assert.equal(loaded.ok, false);
  assert.ok(loaded.error);
  assert.equal(loaded.previousAvailable, true);
  const restored = store.restorePrevious();
  assert.equal(restored.ok, true);
  assert.equal(restored.household.household.name, 'Test family');
  assert.equal(store.loadHousehold().ok, true);
});

test('a write that throws is reported, not swallowed', () => {
  const backing = memoryStorage();
  backing.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  const result = createLocalStore(backing).saveHousehold(fixture().h);
  assert.equal(result.ok, false);
  assert.match(result.error, /storage space/);
});

test('export then import round-trips every key field', () => {
  const demo = demoHousehold(TODAY);
  const text = exportData(demo, new Date('2026-10-25T10:00:00Z'));
  assert.equal(JSON.parse(text).kind, EXPORT_KIND);
  const result = parseImport(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.household, demo);
  assert.equal(result.summary.chores, demo.chores.length);
  assert.equal(result.summary.exportedAt, '2026-10-25T10:00:00.000Z');
});

test('malformed imports are rejected with a reason, and nothing is touched', () => {
  const backing = memoryStorage();
  const store = createLocalStore(backing);
  const { h } = fixture();
  store.saveHousehold(h);
  const before = backing.getItem(KEYS.household);
  for (const text of ['not json', '{"kind":"something-else"}', JSON.stringify({ kind: EXPORT_KIND, data: { chores: 'x' } }), '[]', JSON.stringify({ kind: EXPORT_KIND, data: { schema: 99, chores: [] } })]) {
    const result = parseImport(text);
    assert.equal(result.ok, false, text);
    assert.ok(result.errors.length > 0);
  }
  assert.equal(backing.getItem(KEYS.household), before, 'parseImport never writes');
});

test('a bare household (no export wrapper) is accepted too', () => {
  assert.equal(parseImport(JSON.stringify(fixture().h)).ok, true);
});

test('device settings are kept apart from the household and repaired on load', () => {
  const backing = memoryStorage();
  const store = createLocalStore(backing);
  store.saveDevice({ currentPersonId: 'p1', prefs: { p1: { order: ['tickets', 'nope', 'chores'], hidden: ['settings', 'meals'] } }, theme: 'purple' });
  const d = store.loadDevice();
  assert.equal(d.currentPersonId, 'p1');
  assert.equal(d.theme, 'system');
  assert.deepEqual(d.prefs.p1.order, ['tickets', 'nope', 'chores'], 'matched against installed apps later, not here');
  assert.deepEqual(d.prefs.p1.hidden, ['meals']);
  assert.equal(backing.getItem(KEYS.household), null, 'device settings never land in the household');
  assert.deepEqual(normaliseDevice('garbage').prefs, {});
});

test('clearAll removes everything Family Hub stored', () => {
  const backing = memoryStorage();
  const store = createLocalStore(backing);
  store.saveHousehold(fixture().h);
  store.saveHousehold(fixture().h);
  store.saveDevice({ theme: 'dark' });
  store.clearAll();
  assert.equal(backing.map.size, 0);
});

test('export filename', () => {
  assert.equal(exportFilename(fixture().h, new Date('2026-10-25T10:00:00Z')), 'family-hub-test-family-2026-10-25.json');
});
