// Our bond (D-075): payments over different periods, paid in, taken out, rate changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBond, bondNow, monthsFrom, addMonthsYM } from '../js/apps/homes/bondlog.js';
import { payment } from '../js/apps/finance/maths.js';

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const base = { loan: 900000, ratePct: 10, termYears: 20, start: '2019-12' };

test('D-075 months between, and nothing logged: exactly the planned bond', () => {
  assert.equal(monthsFrom('2019-12', '2020-01'), 1);
  assert.equal(addMonthsYM('2019-12', 61), '2025-01');
  const r = runBond(base);
  assert.equal(r.months, 240);
  near(r.interest, payment(900000, 10 / 1200, 240) * 240 - 900000, 2);
  assert.equal(r.paidOff, '2039-12');
});

test('D-075 paying more for some years, then the minimum: the bond ends sooner, with less interest', () => {
  const min = payment(900000, 10 / 1200, 240);          // about R8 685
  const r = runBond({ ...base, events: [{ kind: 'pay', from: '2020-01', to: '2024-12', amount: 12000 }] });
  assert.ok(r.months < 240 && r.interest < runBond(base).interest);
  // After the period the minimum is paid again - unchanged, so the bond simply ends sooner.
  near(r.rows[61].paidThis, min, 1);
});

test('D-075 paid in once, taken out again, and a rate change', () => {
  const plain = runBond(base);
  assert.ok(runBond({ ...base, events: [{ kind: 'extra', from: '2021-06', amount: 50000 }] }).months < plain.months);
  // Taking R100 000 out after 4 years: the balance rises and the minimum is worked out again over what is left.
  const out = runBond({ ...base, events: [{ kind: 'withdraw', from: '2023-12', amount: 100000 }] });
  assert.ok(out.rows[49].minPmt > plain.rows[49].minPmt);
  assert.equal(out.months, 240);
  near(out.taken, 100000, 0.01);
  const rate = runBond({ ...base, events: [{ kind: 'rate', from: '2022-01', amount: 12 }] });
  assert.ok(rate.rows[30].minPmt > plain.rows[30].minPmt);
  assert.equal(rate.months, 240);
  // A payment below the minimum is raised to it, and said.
  assert.ok(runBond({ ...base, events: [{ kind: 'pay', from: '2020-01', to: '2020-03', amount: 5000 }] }).notes.length > 0);
});

test('D-075 where it stands today, and what paying extra from now would do', () => {
  const v = { ...base, events: [{ kind: 'pay', from: '2020-01', to: '2024-12', amount: 12000 }, { kind: 'withdraw', from: '2023-12', amount: 100000 }] };
  const b = bondNow(v, '2026-10-27');
  assert.equal(b.now, monthsFrom('2019-12', '2026-10'));
  near(b.owedNow, b.actual.rows[b.now].balance, 0.01);
  const more = b.withExtra(2000);
  assert.ok(more.months < b.actual.months && more.interest < b.actual.interest);
  assert.ok(runBond({ loan: 0, start: '2019-12' }).missing);
});
