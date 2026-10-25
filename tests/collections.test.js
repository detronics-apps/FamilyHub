import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollection, CollectionConflict, words } from '../js/collections.js';
import { createMemoryStore } from '../js/folder-store.js';

const tasks = (store, extra = {}) => createCollection(store, {
  app: 'tasks', name: 'tasks', prefix: 'tsk',
  summary: (r) => ({ title: r.title, status: r.status }),
  text: (r) => `${r.title} ${r.notes ?? ''}`,
  ...extra,
});

test('put, get, list, search, remove', async () => {
  const store = createMemoryStore();
  const c = tasks(store);
  const a = await c.put({ title: 'Fix the gate', status: 'open', notes: 'hinge squeaks' });
  const b = await c.put({ title: 'Book the plumber', status: 'open' });
  assert.match(a.id, /^tsk_/);
  assert.equal(a.rev, 1);
  assert.ok(a.createdAt && a.updatedAt && a.schema === 1);
  assert.equal((await c.get(a.id)).notes, 'hinge squeaks');
  assert.equal((await c.list()).total, 2);
  assert.deepEqual((await c.search('hinge')).items.map((x) => x.id), [a.id], 'search reaches beyond the summary');
  assert.equal((await c.search('gate fix')).total, 1, 'every word, any order');
  assert.equal((await c.search('gate plumber')).total, 0);
  assert.equal(await c.remove(b.id), true);
  assert.equal((await c.list()).total, 1);
  assert.equal(await c.get(b.id), null);
  assert.ok(store.files.has('Data/tasks/tasks/index.json'));
  assert.ok(store.files.has(`Data/tasks/tasks/records/${a.id}.json`));
});

test('editing bumps rev and keeps createdAt', async () => {
  const c = tasks(createMemoryStore());
  const a = await c.put({ title: 'One', status: 'open' });
  const got = await c.get(a.id);
  const b = await c.put({ ...got, title: 'One, renamed' });
  assert.equal(b.rev, 2);
  assert.equal(b.createdAt, a.createdAt);
  assert.equal((await c.list()).items[0].title, 'One, renamed', 'the index follows');
});

test('another device edited a different field: both changes kept', async () => {
  const store = createMemoryStore();
  const mineC = tasks(store);
  const theirsC = tasks(store);
  const a = await mineC.put({ title: 'Gate', status: 'open', notes: '' });
  const mine = await mineC.get(a.id);
  const theirs = await theirsC.get(a.id);
  await theirsC.put({ ...theirs, status: 'done' });
  const saved = await mineC.put({ ...mine, notes: 'use WD-40' });
  assert.equal(saved.status, 'done');
  assert.equal(saved.notes, 'use WD-40');
});

test('another device edited the same field: conflict, nothing written', async () => {
  const store = createMemoryStore();
  const mineC = tasks(store);
  const theirsC = tasks(store);
  const a = await mineC.put({ title: 'Gate', status: 'open' });
  const mine = await mineC.get(a.id);
  await theirsC.put({ ...(await theirsC.get(a.id)), title: 'Front gate' });
  const before = store.files.get(`Data/tasks/tasks/records/${a.id}.json`);
  await assert.rejects(mineC.put({ ...mine, title: 'Back gate' }), (e) => e instanceof CollectionConflict && e.conflicts[0].field === 'title');
  assert.equal(store.files.get(`Data/tasks/tasks/records/${a.id}.json`), before);
  const forced = await mineC.put({ ...mine, title: 'Back gate' }, { force: true });
  assert.equal(forced.title, 'Back gate', 'a person can choose theirs or mine explicitly');
});

test('two devices adding records at once do not lose each other’s index entries', async () => {
  const store = createMemoryStore();
  const one = tasks(store);
  const two = tasks(store);
  await one.load();
  await two.load();
  await one.put({ title: 'From laptop one', status: 'open' });
  await two.put({ title: 'From laptop two', status: 'open' });
  const fresh = tasks(store);
  assert.equal((await fresh.list()).total, 2);
});

test('a deletion is not undone by an older index elsewhere', async () => {
  const store = createMemoryStore();
  const one = tasks(store);
  const two = tasks(store);
  const a = await one.put({ title: 'Gone soon', status: 'open' });
  await two.load();
  await one.remove(a.id);
  await two.put({ title: 'Something else', status: 'open' });
  assert.deepEqual((await tasks(store).list()).items.map((x) => x.title), ['Something else']);
});

test('repair: records added, renamed or removed by hand in Drive are reconciled', async () => {
  const store = createMemoryStore();
  const c = tasks(store);
  const a = await c.put({ title: 'Kept', status: 'open' });
  const b = await c.put({ title: 'File deleted by hand', status: 'open' });
  const text = store.files.get(`Data/tasks/tasks/records/${a.id}.json`);
  store.files.delete(`Data/tasks/tasks/records/${a.id}.json`);
  store.files.set('Data/tasks/tasks/records/renamed copy.json', text);                    // renamed in Drive
  store.files.delete(`Data/tasks/tasks/records/${b.id}.json`);                            // deleted in Drive
  store.files.set('Data/tasks/tasks/records/tsk_handmade0001.json', JSON.stringify({ id: 'tsk_handmade0001', title: 'Copied in', status: 'open', rev: 1 }));
  store.files.set('Data/tasks/tasks/records/junk.json', 'not json');
  const report = await c.rebuildIndex();
  assert.equal(report.records, 2);
  assert.deepEqual(report.recovered, ['renamed copy.json']);
  assert.deepEqual(report.missing, [b.id]);
  assert.deepEqual(report.unreadable, ['junk.json']);
  assert.equal((await c.get(a.id)).title, 'Kept', 'back under its own name');
  assert.equal((await c.list()).total, 2);
});

test('data from a newer version of the app is refused', async () => {
  const store = createMemoryStore({ 'Data/tasks/tasks/index.json': JSON.stringify({ kind: 'family-hub-index', schema: 5, entries: {} }) });
  await assert.rejects(tasks(store).list(), /newer version/);
});

test('words: accents and punctuation folded', () => {
  assert.deepEqual(words('Crème brûlée, 2 cups!'), ['creme', 'brulee', '2', 'cups']);
});

/* ---------------------------------------------------------------------- *
 * Large dataset: 5,000 recipes referencing 2,000 ingredients.
 * The claims: startup cost does not grow with the data; a search reads one
 * file (the index) and no records; opening a recipe reads one more file.
 * ---------------------------------------------------------------------- */
test('5,000 recipes: search reads only the index, opening reads one record', async () => {
  const store = createMemoryStore();
  const ingredientNames = Array.from({ length: 2000 }, (_, i) => `ingredient${i}`);
  const adjectives = ['quick', 'creamy', 'spicy', 'roast', 'summer', 'winter', 'lemon', 'garlic', 'smoky', 'herb'];
  const dishes = ['chicken', 'soup', 'pasta', 'salad', 'curry', 'stew', 'pie', 'bake', 'tacos', 'risotto'];
  const entries = {};
  const t0 = performance.now();
  for (let i = 0; i < 5000; i += 1) {
    const id = `rec_${String(i).padStart(12, '0')}`;
    const ingredients = Array.from({ length: 10 }, (_, k) => ({ id: `ing_${(i * 7 + k * 13) % 2000}`, qty: k + 1, unit: 'g' }));
    const r = {
      id, rev: 1, schema: 1, createdAt: '2026-01-01', updatedAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}`,
      title: `${adjectives[i % 10]} ${dishes[Math.floor(i / 10) % 10]} ${i}`,
      minutes: 10 + (i % 50), ingredients, instructions: 'Step one. Step two. Step three. '.repeat(10),
    };
    store.files.set(`Data/meals/recipes/records/${id}.json`, JSON.stringify(r));
    entries[id] = {
      rev: 1, updatedAt: r.updatedAt, s: { title: r.title, minutes: r.minutes, ingredientIds: ingredients.map((x) => x.id) },
      t: words(`${r.title} ${ingredients.map((x) => ingredientNames[Number(x.id.slice(4))]).join(' ')}`).join(' '),
    };
  }
  store.files.set('Data/meals/recipes/index.json', JSON.stringify({ kind: 'family-hub-index', app: 'meals', collection: 'recipes', schema: 1, entries }));
  const buildMs = performance.now() - t0;

  const recipes = createCollection(store, { app: 'meals', name: 'recipes' });
  store.stats.reads = 0;
  const t1 = performance.now();
  await recipes.load();
  const loadMs = performance.now() - t1;
  assert.equal(store.stats.reads, 1, 'opening the collection reads one file');

  const t2 = performance.now();
  const hits = await recipes.search('creamy curry', { limit: 20 });
  const searchMs = performance.now() - t2;
  assert.equal(store.stats.reads, 1, 'searching reads nothing more');
  assert.equal(hits.items.length, 20);
  assert.ok(hits.total > 20);
  assert.ok(hits.items.every((x) => /creamy curry/.test(x.title)));
  assert.ok(!('instructions' in hits.items[0]), 'results are compact summaries');

  const byIngredient = await recipes.list({ filter: (s) => s.ingredientIds.includes('ing_42'), limit: 10 });
  assert.ok(byIngredient.total > 0, 'filter by ingredient reference from the index alone');

  const t3 = performance.now();
  const full = await recipes.get(hits.items[0].id);
  const openMs = performance.now() - t3;
  assert.equal(store.stats.reads, 2, 'opening one recipe reads one record file');
  assert.equal(full.ingredients.length, 10);

  const indexKb = Math.round(store.files.get('Data/meals/recipes/index.json').length / 1024);
  // Reported, not asserted against a machine-dependent threshold (search must stay interactive).
  console.log(`  5000 recipes: build ${buildMs.toFixed(0)} ms, index ${indexKb} KB, load ${loadMs.toFixed(1)} ms, search ${searchMs.toFixed(1)} ms, open ${openMs.toFixed(2)} ms`);
  assert.ok(searchMs < 250, `search took ${searchMs} ms`);
});
