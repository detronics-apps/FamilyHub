// Children's future (D-069): when each cost falls, what to put aside, and the family's overlaps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, exactAge, normalisePlan, schedule, savingAt, family, startingLater } from '../js/apps/children/logic.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-10-27';
const one = (x) => [{ id: 'x', name: 'X', every: 'once', growthPct: 0, saved: 0, others: 0, on: true, ...x }];

test('D-069 ages and the starting list: kept changes, own items, removed ones', () => {
  near(exactAge('2016-10-27', TODAY), 10, 0.01);
  assert.equal(exactAge(null, TODAY), null);
  const p = normalisePlan({ items: [{ id: 'primary', cost: 90000 }, { id: 'wedding', removed: true }, { id: 'braces', name: 'Braces', from: 12, cost: 30000 }] });
  assert.equal(p.items.find((x) => x.id === 'primary').cost, 90000);
  assert.ok(!p.shown.some((x) => x.id === 'wedding'));
  assert.ok(p.items.find((x) => x.id === 'wedding').removed);       // kept, so it does not come back
  assert.equal(p.items.find((x) => x.id === 'braces').every, 'once');
  assert.equal(normalisePlan().items.length, MILESTONES.length);
});

test('D-069 one payment: grown to its date, and the monthly amount that reaches it', () => {
  // R12 000 in exactly 12 months, no growth anywhere: R1 000 a month.
  const s = schedule({ born: '2016-10-27' }, one({ from: 11, cost: 12000 }), TODAY, { savingsPct: 0 });
  assert.equal(s.payments.length, 1);
  assert.equal(s.payments[0].months, 12);
  near(s.monthlyNow, 1000);
  // With 10% a year growth in cost: R13 200; with savings growing, a little less each month.
  const g = schedule({ born: '2016-10-27' }, one({ from: 11, cost: 12000, growthPct: 10 }), TODAY, { savingsPct: 0 });
  near(g.payments[0].amount, 13200);
  assert.ok(schedule({ born: '2016-10-27' }, one({ from: 11, cost: 12000 }), TODAY, { savingsPct: 6 }).monthlyNow < 1000);
  // What is saved already comes off the earliest payment first.
  near(schedule({ born: '2016-10-27' }, one({ from: 11, cost: 12000, saved: 6000 }), TODAY, { savingsPct: 0 }).monthlyNow, 500);
});

test('D-069 yearly costs: the year under way is in the budget now; past years are gone', () => {
  // Age 10, school fees from 6 to 12 at R24 000 a year: age 10 is now (R2 000 a month), 11 and 12 ahead.
  const s = schedule({ born: '2016-06-01' }, [{ id: 'f', name: 'Fees', every: 'year', from: 6, to: 12, cost: 24000, growthPct: 0, on: true }], TODAY, { savingsPct: 0 });
  near(s.nowMonthly, 2000);
  assert.deepEqual(s.payments.map((p) => p.age), [11, 12]);
  // The monthly saving falls once a payment has been made.
  assert.ok(savingAt(s.payments, s.payments[0].months) < s.monthlyNow);
  near(savingAt(s.payments, 0), s.monthlyNow);
});

test('D-069 budget costs are paid as they come, not saved for; save-ahead costs are', () => {
  const s = schedule({ born: '2016-06-01' }, [
    { id: 'f', name: 'Fees', how: 'budget', every: 'year', from: 11, to: 12, cost: 24000, growthPct: 0, on: true },
    { id: 'u', name: 'University', every: 'once', from: 18, cost: 100000, growthPct: 0, on: true },
  ], TODAY, { savingsPct: 0 });
  assert.ok(s.payments.filter((p) => p.budget).every((p) => p.monthly === 0));
  near(s.monthlyNow, s.payments.find((p) => p.item === 'u').monthly);
  const f = family([{ id: 'a', plan: s }]);
  near(f.budgetPeak.budget, 24000);
});

test('D-069 the family: each child counted once, overlapping years found', () => {
  const items = [{ id: 'u', name: 'University', every: 'year', from: 18, to: 20, cost: 70000, growthPct: 0, on: true }];
  const kids = [{ id: 'a', born: '2010-01-01' }, { id: 'b', born: '2012-01-01' }].map((k) => ({ ...k, plan: schedule(k, items, TODAY, { savingsPct: 0 }) }));
  const f = family(kids);
  near(f.total, kids[0].plan.total + kids[1].plan.total);
  near(f.rows.reduce((s, y) => s + y.total, 0), f.total);
  assert.ok(f.overlap.length >= 1);            // two years apart, three-year degrees: one year at least with both
  assert.equal(f.peak.children, 2);
});

test('D-069 starting later costs more a month, and what falls before then is unfunded', () => {
  const s = schedule({ born: '2016-10-27' }, one({ from: 11, cost: 12000 }), TODAY, { savingsPct: 0 });
  near(startingLater(s.payments, 6, 0).monthly, 2000);
  near(startingLater(s.payments, 12, 0).unfunded, 12000);
});
