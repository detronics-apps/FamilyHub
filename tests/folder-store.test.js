import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFolderStore, createMemoryStore, splitPath, stableStringify, FolderError } from '../js/folder-store.js';
import { fakeDirectory } from './helpers.js';

for (const [label, make] of [['folder handle', () => createFolderStore(fakeDirectory())], ['memory', () => createMemoryStore()]]) {
  test(`${label}: write, read, list, remove`, async () => {
    const s = make();
    assert.equal(await s.read('Core/settings.json'), null, 'missing reads as null');
    await s.write('Core/settings.json', '{"a":1}');
    await s.write('Data/chores/events/2026-10.json', '[]');
    assert.equal(await s.read('Core/settings.json'), '{"a":1}');
    assert.deepEqual((await s.list('')).map((e) => e.name), ['Core', 'Data']);
    assert.deepEqual(await s.list('Data/chores/events'), [{ name: '2026-10.json', kind: 'file' }]);
    assert.equal(await s.list('Nope'), null);
    await s.write('Core/settings.json', '{"a":2}');
    assert.equal(await s.read('Core/settings.json'), '{"a":2}', 'overwrite replaces');
    assert.equal(await s.remove('Data/chores'), true, 'removes a folder and its contents');
    assert.equal(await s.read('Data/chores/events/2026-10.json'), null);
    assert.equal(await s.remove('Data/chores'), false);
  });
}

test('bad paths are refused before touching anything', () => {
  for (const p of ['', '../x', 'a/../b', 'a/./b', 'a\\b', 'a:b']) assert.throws(() => splitPath(p), FolderError, p);
  assert.deepEqual(splitPath('/Core//settings.json'), ['Core', 'settings.json']);
});

test('a revoked permission is reported as such', async () => {
  const dir = fakeDirectory();
  const s = createFolderStore(dir);
  await s.write('a.json', '1');
  dir.state.deny = true;
  await assert.rejects(s.read('a.json'), (e) => e instanceof FolderError && e.kind === 'permission');
  await assert.rejects(s.write('b.json', '1'), (e) => e.kind === 'permission');
});

test('stable JSON: same data, same text, whatever the key order', () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } }), stableStringify({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }));
  assert.ok(!stableStringify({ a: undefined, b: 1 }).includes('"a"'));
});
