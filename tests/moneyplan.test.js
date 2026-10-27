// The money plan (D-070): soonest goals first, what is short and by how much, and the fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthAt, monthsTo, simulate, extraToFit, postponeToFit, emergencyGoal, normalisePlan } from '../js/apps/moneyplan/logic.js';

const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-10-27';
const goal = (id, months, amount, extra = {}) => ({ id, title: id, payments: [{ month: monthAt(TODAY, months), amount }], ...extra });
const plan = (free, goals, extra = {}) => ({ income: free, commitments: 0, emergencyMonths: 0, savingsPct: 0, incomeRisePct: 0, commitmentsRisePct: 0, goals, ...extra });

test('D-070 months', () => {
  assert.equal(monthAt(TODAY, 0), '2026-10');
  assert.equal(monthAt(TODAY, 3), '2027-01');
  assert.equal(monthsTo(TODAY, '2027-10'), 12);
});

test('D-070 everything fits: each goal on its own, and together', () => {
  const s = simulate(plan(2000, [goal('holiday', 10, 10000), goal('car', 20, 10000)]), TODAY);
  assert.ok(s.fits);
  near(s.neededNow, 1000 + 500);                       // R10 000 in 10 months + R10 000 in 20 months
  near(s.availNow, 2000);
});

test('D-070 not enough: the soonest goal is funded first, and the later one is short', () => {
  const s = simulate(plan(1000, [goal('holiday', 10, 10000), goal('car', 20, 15000)]), TODAY);
  assert.ok(!s.fits);
  assert.equal(s.goals.find((g) => g.id === 'holiday').short, 0);
  near(s.goals.find((g) => g.id === 'car').short, 5000);          // 20 x R1 000 = R20 000 for R25 000 of goals
  near(extraToFit(plan(1000, [goal('holiday', 10, 10000), goal('car', 20, 15000)]), TODAY), 250, 1);
  assert.equal(postponeToFit(plan(1000, [goal('holiday', 10, 10000), goal('car', 20, 15000)]), TODAY, 'car'), 5);
});

test('D-070 saved already, monthly changes from a goal, and money that grows', () => {
  near(simulate(plan(0, [goal('trip', 6, 6000, { saved: 6000 })]), TODAY).shortTotal, 0);
  // A new bond from month 3 takes R1 500 a month: the later goal no longer fits.
  const s = simulate(plan(2000, [goal('house', 3, 0, { monthly: [{ from: monthAt(TODAY, 3), amount: 1500 }] }), goal('car', 12, 12000)]), TODAY);
  near(s.goals.find((g) => g.id === 'car').short, 12000 - (2 * 2000 + 10 * 500));
  // Growth means less is needed each month than the plain division.
  assert.ok(simulate({ ...plan(2000, [goal('far', 120, 120000)]), savingsPct: 6 }, TODAY).neededNow < 1000);
});

test('D-070 the emergency fund is a must, from months of commitments', () => {
  const e = emergencyGoal(normalisePlan({ commitments: 20000, emergencyMonths: 3, emergencySaved: 10000 }), TODAY);
  assert.equal(e.payments[0].amount, 60000);
  assert.ok(e.must);
  // R60 000 by 12 months at R5 000 a month is exactly enough; by 11 months it is not.
  const flat = { incomeRisePct: 0, commitmentsRisePct: 0 };
  assert.ok(simulate({ income: 25000, commitments: 20000, emergencyMonths: 3, savingsPct: 0, goals: [], ...flat }, TODAY).fits);
  assert.ok(!simulate({ income: 25000, commitments: 20000, emergencyMonths: 3, emergencyBy: monthAt(TODAY, 11), savingsPct: 0, goals: [], ...flat }, TODAY).fits);
  // Income rising faster than commitments leaves more free in later years.
  const s = simulate({ income: 30000, commitments: 20000, incomeRisePct: 6, commitmentsRisePct: 4, emergencyMonths: 0, goals: [goal('later', 24, 1000)] }, TODAY);
  near(s.months[12].avail, 30000 * 1.06 - 20000 * 1.04);
  near(s.months[0].avail, 10000);
});

test('D-070 a job what-if: less money each month and a move to pay for', () => {
  const base = plan(2000, [goal('holiday', 12, 18000)]);
  assert.ok(simulate(base, TODAY).fits);
  const s = simulate(base, TODAY, { jobDelta: () => -1000, more: [goal('move', 6, 5000, { must: true })] });
  assert.ok(!s.fits);
  assert.ok(s.goals.find((g) => g.id === 'move').short < 1);       // the move comes first: it is sooner
  near(s.goals.find((g) => g.id === 'holiday').short, 18000 - (12 * 1000 - 5000));
});
