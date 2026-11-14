// Which folder Family Hub keeps (D-131): the browser grants access to everything in the folder
// that was picked, so a folder with someone else's files in it is asked about first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoot, PATHS } from '../js/folder-sync.js';
import { fakeDirectory } from './helpers.js';

const file = async (dir, name) => { const f = await dir.getFileHandle(name, { create: true }); const w = await f.createWritable(); await w.write('{}'); await w.close(); };
const asker = (answer) => { const calls = []; return { calls, ask: async () => { calls.push(1); return answer; } }; };

test('a folder that already holds Family Hub is used as it is, without a question', async () => {
  const dir = fakeDirectory('Family stuff'); await file(dir, PATHS.marker); await file(dir, 'taxes.pdf');
  const a = asker(false);
  assert.equal(await chooseRoot(dir, a.ask), dir);
  assert.equal(a.calls.length, 0);
});

test('a folder holding a FamilyHub folder with the marker: that inner folder, without a question', async () => {
  const dir = fakeDirectory('My Drive'); await file(dir, 'photos.zip');
  const inner = await dir.getDirectoryHandle('FamilyHub', { create: true }); await file(inner, PATHS.marker);
  const a = asker(false);
  assert.equal(await chooseRoot(dir, a.ask), inner);
  assert.equal(a.calls.length, 0);
});

test('an empty folder, or one called Family Hub, is used without a question', async () => {
  const empty = fakeDirectory('New folder');
  const named = fakeDirectory('Family Hub'); await file(named, 'notes.txt');
  const a = asker(false);
  assert.equal(await chooseRoot(empty, a.ask), empty);
  assert.equal(await chooseRoot(named, a.ask), named);
  assert.equal(a.calls.length, 0);
});

test('another folder with files in it: asked first - Choose another folder keeps nothing, Use it anyway makes FamilyHub inside', async () => {
  const dir = fakeDirectory('My Drive'); await file(dir, 'taxes.pdf');
  const no = asker(false);
  assert.equal(await chooseRoot(dir, no.ask), null);
  assert.equal(no.calls.length, 1);
  assert.ok(!dir.children.has('FamilyHub'), 'nothing made in a folder they did not want to use');
  const yes = asker(true);
  const root = await chooseRoot(dir, yes.ask);
  assert.equal(root.name, 'FamilyHub');
  assert.equal(yes.calls.length, 1);
});
