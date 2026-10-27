import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFamilyFile, parseFamilyFile, collectAppFiles, filesAsStore, describeFamilyFile, familyFileName, isFromPhone } from '../js/family-file.js';
import { createMemoryStore } from '../js/folder-store.js';
import { createCollection, copyAppData } from '../js/collections.js';
import { exportData } from '../js/storage.js';
import { mergeRegistry, starterRegistry, emptyRegistry, uninstall, validateManifest } from '../js/miniapps.js';
import { demoHousehold } from '../js/demo.js';
import { fingerprint } from '../js/folder-sync.js';
import { mergeHousehold } from '../js/merge.js';
import { TODAY } from './helpers.js';

const notes = (store) => createCollection(store, { app: 'notes', name: 'notes', summary: (r) => ({ title: r.title }) });

test('a family file carries the household, the registry and every mini-app record', async () => {
  const phone = createMemoryStore();
  const n = notes(phone);
  await n.put({ title: 'Buy milk' });
  await n.put({ title: 'Call gran' });
  phone.files.set('Data/household/people.json', 'never copied this way');
  const files = await collectAppFiles(phone);
  assert.ok(Object.keys(files).every((p) => p.startsWith('Data/notes/')), 'household files are not duplicated');

  const demo = demoHousehold(TODAY);
  const text = buildFamilyFile({ household: demo, registry: emptyRegistry(), files });
  const parsed = parseFamilyFile(text);
  assert.equal(parsed.ok, true);
  assert.equal(fingerprint(parsed.household), fingerprint(demo));
  assert.match(describeFamilyFile(parsed), /The Example family: 3 people.*2 mini-app records/);

  const laptop = createMemoryStore();
  const report = await copyAppData(filesAsStore(parsed), laptop);
  assert.equal(report.copied, 3);
  assert.equal((await notes(laptop).list()).total, 2);
});

test('importing never replaces a newer record with an older one', async () => {
  const laptop = createMemoryStore();
  const ln = notes(laptop);
  const a = await ln.put({ title: 'v1' });
  const phone = createMemoryStore(new Map(laptop.files));            // phone got a copy at v1
  await ln.put({ ...(await ln.get(a.id)), title: 'v2 on laptop' });     // laptop moves on
  const pn = notes(phone);
  await pn.put({ title: 'new on phone' });
  const report = await copyAppData(phone, laptop);
  assert.equal((await notes(laptop).get(a.id)).title, 'v2 on laptop');
  assert.equal((await notes(laptop).list()).total, 2, 'the phone’s new record arrives');
  assert.ok(report.kept >= 1 && report.merged === 1);
});

test('old v0.1 exports still open', () => {
  const parsed = parseFamilyFile(exportData(demoHousehold(TODAY)));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.legacy, true);
  assert.equal(parsed.household.chores.length, demoHousehold(TODAY).chores.length);
});

test('bad family files are refused with a reason', () => {
  for (const text of ['nope', JSON.stringify({ kind: 'other' }), JSON.stringify({ kind: 'family-hub-family-file', format: 9 }),
    JSON.stringify({ kind: 'family-hub-family-file', format: 1, household: demoHousehold(TODAY), files: { 'Core/evil.js': 'x' } }),
    JSON.stringify({ kind: 'family-hub-family-file', format: 1, household: demoHousehold(TODAY), files: { 'Data/x/../../y': 'x' } })]) {
    const r = parseFamilyFile(text);
    assert.equal(r.ok, false, text.slice(0, 60));
    assert.ok(r.errors.length);
  }
});

test('a phone file carries what it started from, so a chore deleted on the phone stays deleted', () => {
  const base = demoHousehold(TODAY);
  const phone = { ...base, chores: base.chores.slice(1) };                       // deleted one on the phone
  const laptop = { ...base, chores: [...base.chores, { ...base.chores[0], id: 'new-on-laptop', name: 'Water plants' }] };
  const parsed = parseFamilyFile(buildFamilyFile({ household: phone, registry: emptyRegistry(), base }));
  assert.equal(fingerprint(parsed.base), fingerprint(base));
  const { household } = mergeHousehold(parsed.base, laptop, parsed.household);
  const ids = household.chores.map((c) => c.id);
  assert.ok(!ids.includes(base.chores[0].id), 'deleted on the phone');
  assert.ok(ids.includes('new-on-laptop'), 'added on the laptop');
  assert.equal(parseFamilyFile(buildFamilyFile({ household: phone, registry: emptyRegistry() })).base, null, 'the laptops’ own copy has no base');
  assert.deepEqual(['Family Hub.json', 'family-hub-smiths-2026-10-27-09-30.json', 'README.txt', 'Family Hub (1).json'].filter(isFromPhone),
    ['family-hub-smiths-2026-10-27-09-30.json', 'Family Hub (1).json']);
});

test('file names sort by time', () => {
  assert.equal(familyFileName(demoHousehold(TODAY), new Date('2026-10-25T14:05:00Z')), 'family-hub-the-example-family-2026-10-25-14-05.json');
});

test('registries from two laptops merge per app', () => {
  const m = (id) => validateManifest({ fhManifest: 1, id, name: id, version: '1.0.0', requires: { api: 1 }, screens: [{ id: 'main', title: id }], data: { collections: [] }, permissions: [] }, { source: 'starter' }).manifest;
  const base = starterRegistry([m('tasks'), m('tickets')]);
  const mine = uninstall(base, 'tasks');
  const theirs = uninstall(base, 'tickets');
  const { registry, conflicts } = mergeRegistry(base, mine, theirs);
  assert.deepEqual(Object.keys(registry.apps), []);
  assert.deepEqual(Object.keys(registry.retained).sort(), ['tasks', 'tickets']);
  assert.deepEqual(conflicts, []);
});
