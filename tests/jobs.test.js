// Job offers (D-068): SARS estimate, projections, moving cash, payback and overtaking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandTax, estimatePay, project, moveCash, versus, SARS } from '../js/apps/jobs/logic.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const flat = { raisePct: 0, escalatePct: 0 };

test('D-068 SARS 2026/27: the bands, the threshold, rebates and medical credits', () => {
  near(bandTax(245100), 44118);
  near(bandTax(383100), 79998);
  near(bandTax(1000000), 259783 + 0.41 * 113000);
  for (const [from, base, rate] of SARS.bands.slice(1)) near(bandTax(from), base, 0.5);     // each band joins the last
  near(estimatePay({ grossMonthly: 99000 / 12 }).tax, 0);                                  // the tax threshold
  // R30 000 a month: R360 000 a year -> R73 992 - R17 820 rebate = R56 172 tax; UIF R177.12 a month.
  const p = estimatePay({ grossMonthly: 30000 });
  near(p.tax, 56172);
  near(p.uif, 12 * 177.12);
  near(p.monthly, 30000 - 56172 / 12 - 177.12);
  // Retirement contributions come off taxable income; medical credits off the tax.
  near(estimatePay({ grossMonthly: 30000, employeeRetirement: 2000 }).taxable, 360000 - 24000);
  near(estimatePay({ grossMonthly: 30000 }).tax - estimatePay({ grossMonthly: 30000, medicalMembers: 3 }).tax, 12 * (376 + 376 + 254));
  assert.ok(estimatePay({ grossMonthly: 30000, age: 'over65' }).tax < p.tax);
});

test('D-068 projections: payslip pay grows with increases, after the first review', () => {
  const r = project({ takeHome: 25000, raisePct: 10, raiseAfter: 12 }, 36).rows;
  near(r[11].takeHome, 25000);
  near(r[12].takeHome, 27500);
  near(r[24].takeHome, 30250);
  assert.ok(project({ grossMonthly: 30000 }).estimated);
  assert.deepEqual(project({}).missing, ['the salary or the take-home pay']);
});

test('D-068 moving: cash needed first, a refundable deposit is not a cost, time to save', () => {
  const m = moveCash({ moveCost: 50000, moveRefundable: 10000, moveAllowance: 20000, savedForMove: 5000, canSave: 1000 });
  near(m.needed, 60000);                // the allowance comes after the move
  near(m.netCost, 30000);               // the deposit comes back; the employer pays R20 000
  assert.equal(m.monthsToSave, 55);
  assert.equal(moveCash({ moveCost: 50000, canSave: 0 }).monthsToSave, null);
  near(moveCash({ moveCost: 50000, moveAllowance: 20000, allowanceBefore: true }).needed, 30000);
});

test('D-068 payback and overtaking, from the owner’s examples', () => {
  // R60 000 to move for R1 000 a month more after tax and costs: 60 months to pay back.
  const v = versus({ takeHome: 36000, moveCost: 60000, ...flat }, { takeHome: 35000, ...flat }, 120);
  assert.equal(v.payback, 60);
  near(v.monthlyNow, 1000);
  near(v.ahead, 120 * 1000 - 60000);
  // No better off each month: never paid back.
  assert.equal(versus({ takeHome: 35000, moveCost: 60000, ...flat }, { takeHome: 35000, ...flat }).payback, null);
  // R45 000 rising 10% against R50 000 rising 4%: the salary overtakes after the second increase,
  // the running total only later - they are not the same moment.
  const j = versus({ grossMonthly: 45000, raisePct: 10, escalatePct: 0 }, { grossMonthly: 50000, raisePct: 4, escalatePct: 0 }, 180);
  assert.equal(j.salaryAhead, 25);
  assert.ok(j.totalAhead > j.salaryAhead);
  // Months without pay between jobs count as part of what has to be earned back.
  near(versus({ takeHome: 36000, gapMonths: 1, ...flat }, { takeHome: 35000, ...flat }).upfront, 35000);
  // Compared the other way round, the other job's moving cost counts in this one's favour.
  near(versus({ takeHome: 35000, ...flat }, { takeHome: 36000, moveCost: 60000, ...flat }, 120).ahead, 60000 - 120 * 1000);
});
