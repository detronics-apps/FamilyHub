import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseMonth, monthSummary, copyMonth, addSpend, addLine, addIncome, shiftMonth, monthId,
  normaliseGoal, projectSaving, projectDebt, projection, progress, recordAmount, goalTotals,
} from '../js/apps/finance/logic.js';

test('month: planned against spent, per category, with unplanned spending shown', () => {
  let m = normaliseMonth({}, '2026-10');
  m = addLine(m, 'Groceries', 6000);
  m = addLine(m, 'Fuel', 2000);
  m = addIncome(m, 'Salaries', 30000);
  m = addSpend(m, { category: 'groceries', amount: 1250.4 });
  m = addSpend(m, { category: 'Groceries', amount: 800 });
  m = addSpend(m, { category: 'Takeaways', amount: 300 });
  m = addSpend(m, { category: 'Fuel', amount: 'abc' });
  const s = monthSummary(m);
  const row = (c) => s.rows.find((r) => r.category === c);
  assert.deepEqual(row('Groceries'), { category: 'Groceries', planned: 6000, spent: 2050.4, left: 3949.6, unplanned: false });
  assert.equal(row('Takeaways').unplanned, true);
  assert.equal(row('Fuel').spent, 0, 'a non-number is not recorded');
  assert.equal(s.planned, 8000);
  assert.equal(s.spent, 2350.4);
  assert.equal(s.afterPlan, 22000);
});

test('copying a month keeps the plan and income, never the spending', () => {
  const m = addSpend(addLine(normaliseMonth({}, '2026-10'), 'Rent', 9000), { category: 'Rent', amount: 9000 });
  const next = copyMonth(m, '2026-11');
  assert.equal(next.lines.length, 1);
  assert.equal(next.spends.length, 0);
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(monthId('2026-11'), 'month_202611');
});

test('saving projection: simple, with growth, already there, never', () => {
  assert.equal(projectSaving({ current: 0, target: 1200, monthly: 100, ratePct: 0 }).months, 12);
  const grow = projectSaving({ current: 0, target: 1200, monthly: 100, ratePct: 12 });
  assert.ok(grow.months <= 12, 'growth can only shorten it');
  assert.equal(projectSaving({ current: 500, target: 400, monthly: 0 }).months, 0);
  assert.equal(projectSaving({ current: 0, target: 1000, monthly: 0, ratePct: 0 }).months, null);
});

test('debt projection: months, interest, and "never" with the payment that would work', () => {
  const p = projectDebt({ current: 1200, monthly: 100, ratePct: 0 });
  assert.deepEqual(p, { months: 12, interest: 0 });
  const withRate = projectDebt({ current: 10000, monthly: 500, ratePct: 12 });
  assert.equal(withRate.months, 23);
  assert.ok(withRate.interest > 1000 && withRate.interest < 1300, String(withRate.interest));
  const never = projectDebt({ current: 10000, monthly: 90, ratePct: 12 });
  assert.equal(never.months, null);
  assert.equal(never.minimum, 100.01);
});

test('goals: progress, recording, and dates', () => {
  let g = normaliseGoal({ title: 'Holiday fund', target: 12000, current: 3000, monthly: 1000 });
  assert.equal(progress(g), 0.25);
  g = recordAmount(g, 1500);
  assert.equal(g.current, 4500);
  assert.equal(projection(g, '2026-10-25').day, '2027-06-25');
  let d = normaliseGoal({ title: 'Car loan', kind: 'debt', current: 5000, monthly: 1000 });
  d = recordAmount(d, 6000);
  assert.equal(d.current, 0, 'a debt never goes below zero');
  assert.equal(progress(d), null);
  assert.equal(normaliseGoal({ ratePct: 250 }).ratePct, 100);
});

test('totals count each goal once - shared goals are not double counted', () => {
  const goals = [
    normaliseGoal({ title: 'Emergency fund', current: 10000 }),
    normaliseGoal({ title: 'Bike', owner: 'p1', current: 800 }),
    normaliseGoal({ title: 'Card', kind: 'debt', owner: 'p2', current: 2500 }),
  ];
  const t = goalTotals(goals);
  assert.deepEqual(t.byOwner.household, { saved: 10000, owed: 0 });
  assert.deepEqual(t.byOwner.p1, { saved: 800, owed: 0 });
  assert.deepEqual(t.all, { saved: 10800, owed: 2500 });
});
