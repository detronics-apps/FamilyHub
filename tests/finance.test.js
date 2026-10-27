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

/* --------------------------------------------- D-066 money maths, known results */

import { payment, balanceAfter, monthlyRate, effectiveYearly, growth, todaysMoney, carCost, sensitivity, CAR_NUDGES } from '../js/apps/finance/maths.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

test('D-066 loan maths: textbook instalments, balances and effective rates', () => {
  near(payment(150000, 0.01, 60), 3336.67);                 // R150 000 at 12% over 5 years
  near(balanceAfter(150000, 0.01, payment(150000, 0.01, 60), 60), 0);
  near(payment(100000, 0.01, 12, 100000), 1000);            // a 100% balloon: interest only
  near(payment(12000, 0, 12), 1000);                        // no interest
  near(balanceAfter(12000, 0, 1000, 5), 7000);
  near(effectiveYearly(12, 12), 12.6825, 0.0001);
  near(monthlyRate(12, 12), 0.01, 1e-12);
});

test('D-066 compound growth: matches the closed formula, compounding and simple interest', () => {
  near(growth({ start: 10000, ratePct: 10, years: 10, per: 1 }).balance, 25937.42);
  const g = growth({ monthly: 1000, ratePct: 12, years: 10 });
  near(g.balance, 1000 * ((1.01 ** 120 - 1) / 0.01));
  near(g.paidIn, 120000);
  near(g.growth, g.balance - 120000);
  assert.equal(g.rows.length, 10);
  // Paying in at the start of each month earns one month more on every payment.
  near(growth({ monthly: 1000, ratePct: 12, years: 10, timing: 'start' }).balance, g.balance * 1.01);
  // Simple interest on a lump sum: 10% of 10 000 for 10 years.
  near(growth({ start: 10000, ratePct: 10, years: 10 }).simpleBalance, 20000);
  near(todaysMoney(100000, 5, 10), 100000 / 1.05 ** 10);
});

test('D-066 car true cost: nothing counted twice, an early sale, and the "profit" myth', () => {
  const base = { price: 150000, deposit: 0, ratePct: 12, termMonths: 72, keepYears: 5, initiationFee: 1200, serviceFee: 69, insurance: 900, fuel: 2000, upkeep: 400, escalatePct: 5, depreciationPct: 15 };
  for (const extra of [{}, { balloonPct: 30 }, { keepYears: 8 }, { feeFinanced: false }, { deposit: 150000 }, { resaleMode: 'amount', resaleAmount: 170000 }]) {
    const c = carCost({ ...base, ...extra });
    // Total cost = what was paid out - what the sale brings in after settling the loan ...
    near(c.total, c.upfront + c.toBank + c.running - (c.resale - c.owed));
    // ... which is the same as the drop in value + interest + fees + running costs.
    near(c.total, c.depreciation + c.interest + c.fees + c.running);
    near(c.timeline.at(-1).cost, c.total);
  }
  // Sold after 5 years of a 6-year loan: the bank is still owed the remaining balance.
  const early = carCost(base);
  const loan = 150000 + 1200;
  near(early.owed, balanceAfter(loan, 0.01, payment(loan, 0.01, 72), 60));
  assert.ok(early.owed > 0);
  // Selling for more than was paid is not a profit once interest and running costs count.
  const dearer = carCost({ ...base, resaleMode: 'amount', resaleAmount: 160000 });
  assert.ok(dearer.resale > dearer.price && dearer.total > 0);
  // 3 years against 6: lower instalment, more interest.
  const three = carCost({ ...base, termMonths: 36, keepYears: 6 });
  const six = carCost({ ...base, termMonths: 72, keepYears: 6 });
  assert.ok(six.instalment < three.instalment && six.interest > three.interest);
  // Honest about what is missing or impossible.
  assert.deepEqual(carCost({}).missing, ['the price']);
  assert.ok(carCost({ price: 100, deposit: 200 }).error);
  assert.ok(carCost({ price: 100, termMonths: 0 }).error);
  // The biggest lever is listed first.
  const s = sensitivity(base, (v) => carCost(v).total, CAR_NUDGES);
  assert.ok(Math.abs(s[0].change) >= Math.abs(s.at(-1).change));
});

/* ------------------------------------------------------ D-067 homes */

import { transferDuty, homeCost, bond, rentOrBuy, travel } from '../js/apps/finance/maths.js';

test('D-067 transfer duty follows the SARS bands', () => {
  near(transferDuty(1000000), 0);
  near(transferDuty(1210000), 0);
  near(transferDuty(1500000), 8700);                         // 3% of 290 000
  near(transferDuty(2000000), 13614 + 0.06 * 336200);
  near(transferDuty(5000000), 106784 + 0.11 * 2005200);
});

test('D-067 bond: textbook instalment, paying extra, and the cash needed first', () => {
  const b = bond({ price: 1000000, deposit: 100000, ratePct: 12, termYears: 20, fees: 40000 });
  near(b.instalment, 9909.75, 0.05);                       // R900 000 at 12% over 20 years
  near(b.interest, b.instalment * 240 - 900000);
  near(b.cashFirst, 100000 + 0 + 40000);
  assert.equal(b.monthsWithExtra, 240);
  near(b.interestWithExtra, b.interest, 1);
  const more = bond({ price: 1000000, deposit: 100000, ratePct: 12, termYears: 20, extra: 1000 });
  assert.ok(more.monthsWithExtra < 240 && more.interestWithExtra < b.interest);
  near(bond({ price: 1000000, ratePct: 12, termYears: 20, income: 40000 }).share, payment(1000000, 0.01, 240) / 40000);
});

test('D-067 one home: nothing counted twice, travel counted, and a short stay', () => {
  near(travel({ km: 20, days: 21, perKm: 4.95 }).money, 2 * 20 * 21 * 4.95);
  near(travel({ minutes: 30, days: 20 }).hours, 20);
  const base = { price: 1500000, deposit: 150000, ratePct: 11, termYears: 20, stayYears: 5, ratesTaxes: 1200, levies: 800, insurance: 400, km: 25, minutes: 40, moveCost: 15000 };
  for (const extra of [{}, { stayYears: 25 }, { growthPct: -2 }, { deposit: 1500000 }]) {
    const c = homeCost({ ...base, ...extra });
    near(c.total, c.valueChange + c.duty + c.fees + c.move + c.sellCosts + c.interest + c.running + c.travel + c.forgone);
    near(c.timeline.at(-1).cost + c.forgone, c.total);
  }
  const rent = homeCost({ mode: 'rent', rent: 12000, rentDeposit: 24000, moveCost: 8000, stayYears: 5, km: 5 });
  near(rent.total, rent.move + rent.rent + rent.travel + rent.forgone);
  // Staying one year: duty, fees and selling costs are paid in full for a short stay, so a month costs far more.
  const year = homeCost({ ...base, stayYears: 1 });
  assert.ok(year.perMonth > 1.5 * homeCost(base).perMonth);
  // Closer to work: a dearer house can still cost less once the trip is counted.
  const far = homeCost({ ...base, km: 45 });
  const near_ = homeCost({ ...base, price: 1600000, km: 5 });
  assert.ok(near_.travel < far.travel);
  assert.deepEqual(homeCost({}).missing, ['the price']);
  assert.deepEqual(homeCost({ mode: 'rent' }).missing, ['the rent']);
});

test('D-067 rent or buy: same money each month, and when buying gets ahead', () => {
  const v = { price: 1500000, deposit: 150000, ratePct: 11, termYears: 20, rent: 11000, rentDeposit: 11000, ratesTaxes: 1500, insurance: 400, growthPct: 5, otherRatePct: 8, stayYears: 10 };
  const r = rentOrBuy(v);
  near(r.ahead, r.buyer - r.renter);
  assert.equal(r.year, 10);
  assert.equal(r.series.length, 30);
  // Buying needs years to cover duty, fees and selling costs: never ahead after one year here.
  assert.ok(r.series[0].ahead < 0);
  // A house that never grows in value and costs far more each month never gets ahead.
  assert.equal(rentOrBuy({ ...v, growthPct: 0, rent: 3000 }).breakeven, null);
});
