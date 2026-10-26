import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, activeSections, appsIn, sectionOf } from '../js/sections.js';
import { STARTERS } from '../js/apps/catalogue.js';

const starters = STARTERS.map((s) => s.manifest);

test('every starter app belongs to a real section; Meals holds its three', () => {
  for (const m of starters) assert.notEqual(sectionOf(m), 'more', m.id);
  assert.deepEqual(appsIn('meals', starters).map((m) => m.id), ['meals', 'mealplan', 'calories', 'assistant']);
  assert.deepEqual(appsIn('shopping', starters).map((m) => m.id), ['shopping']);
  assert.ok(!starters.some((m) => m.id === 'health'), 'Health was split into Meals and Exercise');
});

test('home shows sections that have something in them, in section order', () => {
  const ids = activeSections(starters).map((s) => s.id);
  assert.deepEqual(ids, SECTIONS.map((s) => s.id).filter((id) => id !== 'more'));
  assert.ok(activeSections([...starters, { id: 'x', section: 'more' }]).some((s) => s.id === 'more'));
});

test('every starter names its ways in - plan, check and note, or do - and each points at a real screen', async () => {
  const { validateManifest, MODES } = await import('../js/miniapps.js');
  for (const m of starters) {
    assert.ok(m.modes?.length, `${m.id} names its ways in`);
    for (const x of m.modes) {
      assert.ok(MODES[x.mode], `${m.id}: ${x.mode}`);
      assert.ok(m.screens.some((s) => s.id === x.screen), `${m.id}: ${x.screen}`);
    }
  }
  const bad = validateManifest({ ...starters.find((m) => m.id === 'shopping'), modes: [{ mode: 'nap', screen: 'nowhere', label: '' }] }, { source: 'starter' });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 2, 'an unknown mode and an empty label');
  for (const sec of ['meals', 'shopping', 'faith']) assert.ok(appsIn(sec, starters).some((m) => m.modes.some((x) => x.mode === 'do')), `${sec} has something to do`);
});
