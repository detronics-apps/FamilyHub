import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisePrinciple, principleSummary, reviewDue, EXAMPLES, KINDS } from '../js/apps/principles/logic.js';

test('a principle needs only a name', () => {
  const p = normalisePrinciple({ title: ' Be kind ' });
  assert.equal(p.title, 'Be kind');
  assert.equal(p.kind, 'guideline');
  assert.equal(p.status, 'active');
  assert.deepEqual(p.apply, []);
});

test('"how we apply it" accepts lines or a list', () => {
  assert.deepEqual(normalisePrinciple({ apply: 'one\n\n two \n' }).apply, ['one', 'two']);
  assert.deepEqual(normalisePrinciple({ apply: ['a', ' ', 'b'] }).apply, ['a', 'b']);
});

test('review is due only for active principles whose date has come', () => {
  const s = (o) => principleSummary(normalisePrinciple({ title: 'x', ...o }));
  assert.equal(reviewDue(s({ reviewOn: '2026-10-25' }), '2026-10-25'), true);
  assert.equal(reviewDue(s({ reviewOn: '2026-10-26' }), '2026-10-25'), false);
  assert.equal(reviewDue(s({ reviewOn: '2026-10-01', status: 'retired' }), '2026-10-25'), false);
  assert.equal(reviewDue(s({}), '2026-10-25'), false);
});

test('the plan’s two examples are complete and labelled as examples', () => {
  assert.equal(EXAMPLES.length, 2);
  for (const ex of EXAMPLES) {
    const p = normalisePrinciple(ex);
    assert.ok(p.demo && p.belief && p.apply.length && KINDS[p.kind], ex.title);
  }
  assert.match(normalisePrinciple(EXAMPLES[1]).exceptions, /childcare/);
});
