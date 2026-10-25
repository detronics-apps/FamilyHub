import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseDecision, decisionSummary, stage, startTrial, addObservation, recordOutcome, revise } from '../js/apps/decisions/logic.js';

const TODAY = '2026-10-25';

test('the cycle: observe -> discuss -> decide -> experiment -> review -> adapt', () => {
  let d = normaliseDecision({ title: 'Screen-time transitions', issue: 'Switching off is a fight most evenings.' });
  assert.equal(stage(d, TODAY), 'observe');
  d = { ...d, alternatives: ['A 10-minute warning', 'A visual timer'] };
  assert.equal(stage(d, TODAY), 'discuss');
  d = { ...d, agreement: 'Use a visual timer and a 10-minute warning.' };
  assert.equal(stage(d, TODAY), 'decide');
  d = startTrial(d, TODAY);
  assert.equal(d.reviewOn, '2026-11-08', 'two weeks unless chosen');
  assert.equal(stage(d, TODAY), 'experiment');
  assert.equal(stage(d, '2026-11-08'), 'review');
  d = recordOutcome(d, 'improved', 'Works better with the warning at 15 minutes.');
  assert.equal(stage(d, '2026-11-08'), 'adapt');
  assert.equal(stage(decisionSummary(d), TODAY), 'adapt', 'works from the index summary too');
});

test('cannot try an agreement that was never written down', () => {
  assert.throws(() => startTrial(normaliseDecision({ title: 'x' }), TODAY), /Write down what you agreed/);
});

test('observations are kept in order with who and when', () => {
  let d = normaliseDecision({ title: 'x' });
  d = addObservation(d, 'Calmer on Monday', { by: 'p1', today: TODAY, id: 'a' });
  d = addObservation(d, '   ', { today: TODAY });
  d = addObservation(d, 'Tears on Wednesday', { today: '2026-10-27', id: 'b' });
  assert.deepEqual(d.observations.map((o) => [o.id, o.day, o.by]), [['a', TODAY, 'p1'], ['b', '2026-10-27', null]]);
});

test('a decision can be revised, and the earlier agreement is kept', () => {
  let d = startTrial(normaliseDecision({ title: 'x', agreement: 'Plan A' }), TODAY);
  d = recordOutcome(d, 'replaced');
  d = revise(d, 'Plan B', { now: '2026-11-09T09:00:00Z', today: '2026-11-09' });
  assert.equal(d.agreement, 'Plan B');
  assert.equal(d.status, 'trying');
  assert.equal(d.outcome, null);
  assert.deepEqual(d.history, [{ at: '2026-11-09T09:00:00Z', agreement: 'Plan A', outcome: 'replaced' }]);
  assert.equal(revise(d, 'Plan B', { today: TODAY }), d, 'no change, no new history');
  assert.throws(() => revise(d, ' ', { today: TODAY }), /empty/);
});

test('unknown outcomes are refused', () => {
  assert.throws(() => recordOutcome(normaliseDecision({}), 'meh'), /Unknown outcome/);
});
