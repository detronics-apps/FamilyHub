import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManifest, compatibility, satisfies, compareVersions, install, setEnabled, update, uninstall,
  forgetRetained, starterRegistry, reconcileStarters, normaliseRegistry, emptyRegistry, permissionInfo, CORE_VERSION,
} from '../js/miniapps.js';

const third = (over = {}) => ({
  fhManifest: 1, id: 'com.example.notes', name: 'Notes', version: '1.0.0', description: 'Family notes',
  requires: { api: 1, core: '>=0.2.0 <1.0.0' }, entry: 'app.js',
  screens: [{ id: 'main', title: 'Notes' }], data: { collections: [{ name: 'notes', schema: 1 }] },
  permissions: ['data:own', 'notify'], ...over,
});
const ok = (raw, opts) => { const r = validateManifest(raw, opts); assert.deepEqual(r.errors, []); return r.manifest; };

test('a good third-party manifest validates and is normalised', () => {
  const m = ok(third());
  assert.equal(m.id, 'com.example.notes');
  assert.deepEqual(m.screens, [{ id: 'main', title: 'Notes', nav: true }]);
});

test('bad manifests are refused with every reason', () => {
  const r = validateManifest({ fhManifest: 2, id: 'Bad ID', name: '', version: '1', requires: {}, screens: [], permissions: ['everything'] });
  assert.equal(r.ok, false);
  for (const bit of ['fhManifest', '"id"', '"name"', '"version"', 'requires.api', 'entry', 'screens', 'Unknown permission']) {
    assert.ok(r.errors.some((e) => e.includes(bit)), bit);
  }
  assert.equal(validateManifest(null).ok, false);
  assert.equal(validateManifest([]).ok, false);
});

test('third-party code cannot ask for first-party powers or escape its package', () => {
  assert.ok(validateManifest(third({ permissions: ['data:own', 'household:chores'] })).errors.some((e) => /only available/.test(e)));
  assert.ok(validateManifest(third({ entry: '../core/main.js' })).errors.some((e) => /entry/.test(e)));
  assert.ok(validateManifest(third({ entry: 'https://evil.example/app.js' })).errors.some((e) => /entry/.test(e)));
  assert.ok(validateManifest(third({ id: 'settings' })).errors.some((e) => /reserved/.test(e)));
  assert.ok(validateManifest(third({ permissions: [] })).errors.some((e) => /data:own/.test(e)));
});

test('cross-app permissions are understood and named', () => {
  assert.ok(ok(third({ permissions: ['data:own', 'data:tasks:read'] })));
  assert.match(permissionInfo('data:tasks:read').label, /Read records of the tasks/);
  assert.equal(permissionInfo('data:tasks:write'), null, 'only the owner writes its records');
  assert.equal(permissionInfo('data:TASKS:read'), null);
});

test('versions and compatibility', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.ok(satisfies('0.2.0', '>=0.2.0 <1.0.0'));
  assert.ok(!satisfies('1.0.0', '>=0.2.0 <1.0.0'));
  assert.equal(compatibility(ok(third())).ok, true);
  assert.match(compatibility(ok(third({ requires: { api: 2 } }))).reason, /interface version 2/);
  assert.match(compatibility(ok(third({ requires: { api: 1, core: '>=9.0.0' } }))).reason, new RegExp(CORE_VERSION.replace(/\./g, '\\.')));
});

test('install needs every permission approved', () => {
  const m = ok(third());
  assert.throws(() => install(emptyRegistry(), m, { granted: ['data:own'] }), /approval/);
  const { registry } = install(emptyRegistry(), m, { granted: m.permissions, codeHash: 'abc', packagePath: 'MiniApps/ThirdParty/Notes' });
  assert.equal(registry.apps[m.id].enabled, true);
  assert.equal(registry.apps[m.id].codeHash, 'abc');
  assert.throws(() => install(registry, m, { granted: m.permissions }), /already installed/);
});

test('disable keeps it installed; enable brings it back', () => {
  const m = ok(third());
  let reg = install(emptyRegistry(), m, { granted: m.permissions }).registry;
  reg = setEnabled(reg, m.id, false);
  assert.equal(reg.apps[m.id].enabled, false);
  assert.equal(setEnabled(reg, m.id, true).apps[m.id].enabled, true);
});

test('uninstall keeps the data; reinstall recovers it', () => {
  const m = ok(third());
  let reg = install(emptyRegistry(), m, { granted: m.permissions }).registry;
  reg = uninstall(reg, m.id);
  assert.equal(reg.apps[m.id], undefined);
  assert.deepEqual(reg.retained[m.id].dataSchemas, { notes: 1 });
  const again = install(reg, m, { granted: m.permissions });
  assert.equal(again.recovered, true);
  assert.equal(again.registry.retained[m.id], undefined);
});

test('reinstalling an older version cannot read newer kept data, and leaves it alone', () => {
  const v2 = ok(third({ version: '2.0.0', data: { collections: [{ name: 'notes', schema: 2 }] } }));
  let reg = install(emptyRegistry(), v2, { granted: v2.permissions }).registry;
  reg = uninstall(reg, v2.id);
  assert.throws(() => install(reg, ok(third()), { granted: ['data:own', 'notify'] }), /newer version.*left untouched/s);
  assert.ok(reg.retained[v2.id], 'still retained');
});

test('deleting retained data is separate, and only after uninstall', () => {
  const m = ok(third());
  let reg = install(emptyRegistry(), m, { granted: m.permissions }).registry;
  assert.throws(() => forgetRetained(reg, m.id), /Uninstall/);
  reg = forgetRetained(uninstall(reg, m.id), m.id);
  assert.equal(reg.retained[m.id], undefined);
});

test('update: must be newer, new permissions need approval, data never goes back', () => {
  const m = ok(third());
  const reg = install(emptyRegistry(), m, { granted: m.permissions }).registry;
  assert.throws(() => update(reg, m, {}), /not newer/);
  const v11 = ok(third({ version: '1.1.0', permissions: ['data:own', 'notify', 'people:read'] }));
  assert.throws(() => update(reg, v11, { granted: [] }), /new permissions/);
  const r = update(reg, v11, { granted: ['people:read'] });
  assert.deepEqual(r.addedPermissions, ['people:read']);
  const v2 = ok(third({ version: '2.0.0', data: { collections: [{ name: 'notes', schema: 3 }] } }));
  const at3 = update(reg, v2, {}).registry;
  const v3 = ok(third({ version: '3.0.0', data: { collections: [{ name: 'notes', schema: 2 }] } }));
  assert.throws(() => update(at3, v3, {}), /older version/);
});

test('starter pack: installed by default, follows shipped versions, respects uninstalls', () => {
  const starter = (v = '1.0.0') => ok({ ...third(), id: 'chores', name: 'Chores', version: v, entry: undefined, permissions: ['data:own', 'household:chores'] }, { source: 'starter' });
  let reg = starterRegistry([starter()]);
  assert.equal(reg.apps.chores.source, 'starter');
  reg = reconcileStarters(reg, [starter('1.1.0')]);
  assert.equal(reg.apps.chores.version, '1.1.0');
  reg = uninstall(reg, 'chores');
  reg = reconcileStarters(reg, [starter('1.2.0')]);
  assert.equal(reg.apps.chores, undefined, 'an uninstalled starter app stays uninstalled');
});

test('a hostile registry file is repaired, not trusted', () => {
  const reg = normaliseRegistry({ apps: { 'Bad Id': {}, ok: { version: 'x', granted: ['everything', 'notify'], enabled: 'yes' } }, retained: 'nope' });
  assert.deepEqual(Object.keys(reg.apps), ['ok']);
  assert.equal(reg.apps.ok.version, '0.0.0');
  assert.deepEqual(reg.apps.ok.granted, ['notify']);
  assert.deepEqual(reg.retained, {});
});

test('the example package in examples/ is a valid, compatible third-party mini-app', async () => {
  const { readFileSync } = await import('node:fs');
  const raw = JSON.parse(readFileSync(new URL('../examples/miniapps/FamilyNotes/manifest.json', import.meta.url), 'utf8'));
  const m = ok(raw);
  assert.equal(compatibility(m).ok, true);
  assert.deepEqual(m.data.collections[0].summary, ['title', 'author']);
  assert.ok(readFileSync(new URL(`../examples/miniapps/FamilyNotes/${m.entry}`, import.meta.url), 'utf8').includes('FamilyHub.ready'));
});

test('a manifest names its section; an unknown or missing one becomes "more"', () => {
  assert.equal(ok(third({ section: 'meals' })).section, 'meals');
  assert.equal(ok(third({ section: 'gardening' })).section, 'more');
  assert.equal(ok(third()).section, 'more');
  assert.equal(validateManifest(third({ section: 7 })).ok, false);
  assert.equal(validateManifest(third({ permissions: ['data:own', 'people:food'] })).ok, false, 'food profiles are for the apps that ship with Family Hub');
});

test('a starter app this version no longer ships is uninstalled, its records kept', () => {
  const old = ok({ ...third(), id: 'health', entry: undefined }, { source: 'starter' });
  const keep = ok({ ...third(), id: 'chores', entry: undefined }, { source: 'starter' });
  const reg = reconcileStarters(starterRegistry([old, keep]), [keep]);
  assert.ok(!reg.apps.health);
  assert.equal(reg.retained.health.name, 'Notes');
  assert.ok(reg.apps.chores);
});
