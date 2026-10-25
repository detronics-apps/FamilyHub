import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { householdProgress, activity } from '../js/progress.js';
import { recordEvent } from '../js/model.js';
import { demoHousehold } from '../js/demo.js';
import { fixture, TODAY } from './helpers.js';

const at = (day) => new Date(`${day}T12:00:00`);

test('counts what was done this week and what is ready, by room', () => {
  let { h, ids, ann, kitchen } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.counters, type: 'done', by: ann }, at(TODAY)));
  ({ household: h } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at('2026-10-10')));   // too long ago
  const p = householdProgress(h, TODAY);
  assert.equal(p.doneCount, 1);
  assert.equal(p.rooms.find((r) => r.roomId === kitchen).done, 1);
  assert.ok(p.readyCount > 0);
});

test('progress carries no per-person figures', () => {
  const p = householdProgress(demoHousehold(TODAY), TODAY);
  const text = JSON.stringify(p);
  for (const id of ['p_demo_alex', 'p_demo_sam', 'p_demo_mia']) assert.ok(!text.includes(id), id);
  // And the module has no way to make one: it never groups by `by`.
  assert.ok(!/\.by\b/.test(readFileSync(new URL('../js/progress.js', import.meta.url), 'utf8').split('export function activity')[0]));
});

test('the example household asks for exactly one review - the oven', () => {
  const p = householdProgress(demoHousehold(TODAY), TODAY);
  assert.deepEqual(p.review.map((c) => c.name), ['Clean the oven']);
});

test('activity is newest first and names who did it', () => {
  let { h, ids, ann } = fixture();
  ({ household: h } = recordEvent(h, { choreId: ids.oven, type: 'done', by: ann }, at('2026-10-20')));
  ({ household: h } = recordEvent(h, { choreId: ids.floor, type: 'skipped' }, at(TODAY)));
  const list = activity(h);
  assert.equal(list[0].what, 'Kitchen floor');
  assert.equal(list[0].action, 'Skipped this time');
  assert.equal(list[1].who, 'Ann');
});
