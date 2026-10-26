import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, activeSections, appsIn, sectionOf } from '../js/sections.js';
import { STARTERS } from '../js/apps/catalogue.js';

const starters = STARTERS.map((s) => s.manifest);

test('every starter app belongs to a real section; Meals holds its three', () => {
  for (const m of starters) assert.notEqual(sectionOf(m), 'more', m.id);
  assert.deepEqual(appsIn('meals', starters).map((m) => m.id), ['meals', 'calories', 'assistant']);
  assert.ok(!starters.some((m) => m.id === 'health'), 'Health was split into Meals and Exercise');
});

test('home shows sections that have something in them, in section order', () => {
  const ids = activeSections(starters).map((s) => s.id);
  assert.deepEqual(ids, SECTIONS.map((s) => s.id).filter((id) => id !== 'more'));
  assert.ok(activeSections([...starters, { id: 'x', section: 'more' }]).some((s) => s.id === 'more'));
});
