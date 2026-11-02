// Us (D-102): the childcare rule shapes Dates; Dates and Goals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careRule } from '../js/apps/parenting/logic.js';
import { STARTER } from '../js/apps/parenting/content.js';
import { normaliseDecision, decisionSummary } from '../js/apps/decisions/logic.js';
import { datesOf, pickDates, kidsAllowed, loved, logDate, plannedDates, STARTER_DATES } from '../js/apps/dates/logic.js';
import { normaliseGoal, grouped, setStatus, moneyLine } from '../js/apps/goals/logic.js';
import { starter } from '../js/apps/catalogue.js';

const rule = (x) => ({ id: x.id ?? 'd', ...decisionSummary(normaliseDecision({ source: 'parenting:childcare', agreement: 'agreed', ...x })) });
const kids = [{ id: 'k', months: 40 }];

test('the childcare rule in force: the strictest one agreed for a child this age', () => {
  assert.equal(careRule([rule({ careBy: 'us', ageFrom: 0, ageTo: 216 })], kids), 'us');
  assert.equal(careRule([rule({ careBy: 'family', ageFrom: 0, ageTo: 216 }), rule({ id: 'e', careBy: 'us', ageFrom: 0, ageTo: 60 })], kids), 'us');
  assert.equal(careRule([rule({ careBy: 'us', ageFrom: 0, ageTo: 24 })], kids), null, 'past its ages');
  assert.equal(careRule([rule({ careBy: 'us', agreement: '' })], kids), null, 'not agreed yet');
  assert.ok(STARTER.some((t) => t.id === 'childcare' && !t.later));
});

test('with "only us", no date ever needs someone else to look after the children - and none is offered', () => {
  const list = datesOf([]);
  assert.deepEqual(kidsAllowed('us'), ['asleep', 'with']);
  const ok = pickDates(list, { rule: 'us' });
  assert.ok(ok.length > 10);
  assert.ok(ok.every((d) => d.kids !== 'away'));
  assert.deepEqual(pickDates(list, { rule: 'us', kids: 'away' }), [], 'even when asked for');
  assert.ok(pickDates(list, {}).some((d) => d.kids === 'away'), 'without a rule, all are there');
  assert.ok(STARTER_DATES.filter((d) => d.kids !== 'away').length >= 15);
});

test('dates: tired evening, nothing new to buy, the time we have; both score it', () => {
  const list = datesOf([]);
  const tired = pickDates(list, { rule: 'us', energy: 'low', free: true, maxMinutes: 90 });
  assert.ok(tired.length && tired.every((d) => d.energy === 'low' && d.prep + d.lasts <= 90));
  const d = logDate(list.find((x) => x.dateId === 'stargaze'), { day: '2026-11-02', scores: { a: 5, b: 4 } });
  assert.equal(loved(d), 4.5);
  assert.deepEqual(plannedDates(datesOf([{ dateId: 'stargaze', plannedOn: '2026-11-07' }]), '2026-11-02').map((x) => x.dateId), ['stargaze']);
});

test('goals: doing, planning, someday, done; done keeps its day; money only linked', () => {
  const gs = [{ goalId: 'a', name: 'Weekend away', status: 'doing', by: '2027-03-01' }, { goalId: 'b', name: 'Learn to dance', status: 'someday' }, { goalId: 'c', name: 'Garden', status: 'done', doneOn: '2026-10-01' }].map(normaliseGoal);
  const g = grouped(gs);
  assert.deepEqual([g.doing.length, g.planning.length, g.someday.length, g.done.length], [1, 0, 1, 1]);
  assert.equal(setStatus(gs[0], 'done', '2026-11-02').doneOn, '2026-11-02');
  assert.equal(setStatus(gs[2], 'doing', '2026-11-02').doneOn, null);
  assert.equal(moneyLine({ target: 40000, current: 12000 }), 'R12 000 of R40 000 (30%)');
});

test('Us holds Decisions, Dates and Goals; Dates may see the decisions and ages it needs', () => {
  for (const id of ['decisions', 'dates', 'goals']) assert.equal(starter(id).manifest.section, 'us', id);
  for (const p of ['data:decisions:read', 'people:ages']) assert.ok(starter('dates').manifest.permissions.includes(p), p);
});
