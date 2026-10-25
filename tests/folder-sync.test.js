import { test } from 'node:test';
import assert from 'node:assert/strict';
import { householdToFiles, filesToHousehold, syncHousehold, readHouseholdFiles, writeHousehold, fingerprint, PATHS } from '../js/folder-sync.js';
import { createMemoryStore, createFolderStore } from '../js/folder-store.js';
import { recordEvent, updateChore, setHouseholdName } from '../js/model.js';
import { mergeHousehold } from '../js/merge.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, fakeDirectory, TODAY } from './helpers.js';

const at = (day, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`);

test('a household round-trips through its files exactly', () => {
  const demo = demoHousehold(TODAY);
  const back = filesToHousehold(householdToFiles(demo));
  assert.equal(fingerprint(back), fingerprint(demo));
});

test('the folder is readable: one file per kind, completions by month', () => {
  const files = householdToFiles(demoHousehold(TODAY));
  assert.ok(files.has(PATHS.marker) && files.has(PATHS.people) && files.has(PATHS.chores));
  const months = [...files.keys()].filter((p) => p.startsWith(PATHS.eventsDir));
  assert.ok(months.length >= 1 && months.every((p) => /\/\d{4}-\d{2}\.json$/.test(p)));
  assert.ok(files.get(PATHS.chores).includes('"Clean the oven"'), 'plain JSON a person can read');
});

test('first connect to an empty folder writes everything', async () => {
  const store = createFolderStore(fakeDirectory());
  const { h } = fixture();
  const r = await syncHousehold(store, { base: null, mine: h });
  assert.equal(r.status, 'written');
  assert.equal(fingerprint(filesToHousehold(await readHouseholdFiles(store))), fingerprint(h));
  assert.ok(await store.read('MiniApps/README.txt'), 'the folder explains itself');
});

test('only changed files are rewritten', async () => {
  const store = createMemoryStore();
  let { h, ids, ann } = fixture();
  await writeHousehold(store, h);
  const before = store.stats.writes;
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  const written = await writeHousehold(store, h);
  assert.deepEqual(written, [`${PATHS.eventsDir}/2026-10.json`]);
  assert.equal(store.stats.writes - before, 1);
});

test('nothing changed anywhere: no writes', async () => {
  const store = createMemoryStore();
  const { h } = fixture();
  await writeHousehold(store, h);
  const r = await syncHousehold(store, { base: h, mine: h });
  assert.equal(r.status, 'unchanged');
});

test('only this device changed: written', async () => {
  const store = createMemoryStore();
  const { h: base } = fixture();
  await writeHousehold(store, base);
  const mine = setHouseholdName(base, 'New name');
  const r = await syncHousehold(store, { base, mine });
  assert.equal(r.status, 'written');
  assert.equal(filesToHousehold(await readHouseholdFiles(store)).household.name, 'New name');
});

test('only the other laptop changed: adopted, nothing overwritten', async () => {
  const store = createMemoryStore();
  const { h: base, ids, ann } = fixture();
  await writeHousehold(store, base);
  const theirs = recordEvent(base, { choreId: ids.oven, type: 'done', by: ann }, at(TODAY)).household;
  await writeHousehold(store, theirs);                         // laptop B, synced in by Drive
  const r = await syncHousehold(store, { base, mine: base });
  assert.equal(r.status, 'adopted');
  assert.equal(r.household.events.length, 1);
});

test('both changed different things: merged and written', async () => {
  const store = createMemoryStore();
  const { h: base, ids, ann } = fixture();
  await writeHousehold(store, base);
  await writeHousehold(store, recordEvent(base, { choreId: ids.oven, type: 'done', by: ann }, at(TODAY, 9)).household);
  const mine = recordEvent(base, { choreId: ids.basin, type: 'done', by: ann }, at(TODAY, 10)).household;
  const r = await syncHousehold(store, { base, mine });
  assert.equal(r.status, 'merged');
  assert.equal(filesToHousehold(await readHouseholdFiles(store)).events.length, 2);
});

test('both changed the same field: conflict reported and NOTHING written', async () => {
  const store = createMemoryStore();
  const { h: base, ids } = fixture();
  await writeHousehold(store, base);
  const theirs = updateChore(base, ids.floor, { minutes: 30 });
  await writeHousehold(store, theirs);
  const snapshot = new Map(store.files);
  const r = await syncHousehold(store, { base, mine: updateChore(base, ids.floor, { minutes: 20 }) });
  assert.equal(r.status, 'conflict');
  assert.equal(r.conflicts[0].field, 'minutes');
  assert.deepEqual(store.files, snapshot, 'the folder is untouched until a person decides');
});

test('first connect to a folder that already has a family: the person decides', async () => {
  const store = createMemoryStore();
  await writeHousehold(store, demoHousehold(TODAY));
  const { h } = fixture();
  const r = await syncHousehold(store, { base: null, mine: h });
  assert.equal(r.status, 'first-connect');
  assert.equal(r.theirs.household.name, 'The Example family');
  // "Merge mine into it" is a two-way merge: nothing from either side is lost.
  const merged = mergeHousehold(null, r.theirs, h).household;
  assert.equal(merged.chores.length, r.theirs.chores.length + h.chores.length);
});

test('a folder from a newer version is refused, not half-read', () => {
  const files = householdToFiles(fixture().h);
  files.set(PATHS.marker, JSON.stringify({ kind: 'family-hub-folder', schema: 99 }));
  assert.throws(() => filesToHousehold(files), /newer version/);
  files.set(PATHS.marker, JSON.stringify({ kind: 'something-else' }));
  assert.throws(() => filesToHousehold(files), /not made by Family Hub/);
});

test('a different household in the folder is never merged into this one', async () => {
  const store = createMemoryStore();
  await writeHousehold(store, demoHousehold(TODAY));
  const { h } = fixture();
  await assert.rejects(syncHousehold(store, { base: h, mine: h }), /different household/);
});
