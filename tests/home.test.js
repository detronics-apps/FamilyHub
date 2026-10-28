// One home, whole (D-078): sections that can be left out, scenarios with and without,
// and any homes compared on the same money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePlan, withAndWithout, sameMoney, kindOf } from '../js/apps/homes/home.js';
import { homeCost } from '../js/apps/finance/maths.js';

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-10-28';
const buy = { kind: 'buy', price: 1800000, deposit: 180000, ratePct: 11, termYears: 20, stayYears: 10, ratesTaxes: 1500, insurance: 600, maintMode: 'percent', upkeepPct: 1, km: 20, growthPct: 5, sellPct: 7.5, otherRatePct: 7 };

test('D-078 buying: the same answer as before, counted month by month', () => {
  const p = homePlan(buy, TODAY);
  near(-p.ahead, homeCost({ ...buy, mode: 'buy' }).total, 50);
  assert.equal(p.months.length, 360);
  assert.ok(p.months[0].ahead < 0);                        // selling at once loses duty, fees and the agent
});

test('D-078 ticks: a section left out counts nothing', () => {
  const p = homePlan(buy, TODAY);
  const noTravel = homePlan({ ...buy, on: { travel: false } }, TODAY);
  assert.ok(noTravel.monthNow < p.monthNow && noTravel.ahead > p.ahead);
  const cash = homePlan({ ...buy, on: { bond: false } }, TODAY);
  assert.equal(cash.loan, 0); assert.equal(cash.bond, null);
  assert.ok(cash.fromPocket > p.fromPocket);
});

test('D-078 scenarios: paying more shortens the bond and saves interest; with and without', () => {
  const w = withAndWithout({ ...buy, scenarios: [{ kind: 'more', from: '2027-01', to: '2031-12', amount: 5000, on: true }] }, TODAY);
  assert.ok(w.any && w.sooner > 0 && w.interestSaved > 0);
  // An unticked scenario changes nothing.
  const off = withAndWithout({ ...buy, scenarios: [{ kind: 'more', from: '2027-01', to: '2031-12', amount: 5000, on: false }] }, TODAY);
  assert.equal(off.sooner, 0); near(off.better, 0, 0.01);
  // Taking money back out: it comes into your pocket that month, and more is owed.
  const out = homePlan({ ...buy, scenarios: [{ kind: 'withdraw', from: '2028-06', amount: 100000 }] }, TODAY);
  const m = out.months.find((x) => x.ym === '2028-06');
  near(m.taken, 100000); assert.ok(m.owed > homePlan(buy, TODAY).months.find((x) => x.ym === '2028-06').owed);
});

test('D-078 after the bond: the old instalment is invested and grows', () => {
  const short = { ...buy, termYears: 5, stayYears: 10 };
  const off = homePlan(short, TODAY); const on = homePlan({ ...short, on: { afterBond: true } }, TODAY);
  assert.equal(off.at.inv, 0);
  assert.ok(on.at.inv > on.months.slice(0, on.stay).reduce((s, x) => s + x.put, 0));   // more than was put in: it grew
});

test('D-078 ours already: measured from selling today; the history and a pay-more scenario', () => {
  const own = { kind: 'own', worthNow: 3200000, boughtFor: 1500000, bondLoan: 900000, bondStart: '2019-12', bondYears: 14, bondRate: 9, stayYears: 10, sellPct: 7.5, growthPct: 6,
    bondEvents: [{ kind: 'pay', from: '2020-01', to: '2026-09', amount: 12000 }, { kind: 'withdraw', from: '2023-12', amount: 100000 }] };
  const p = homePlan(own, TODAY);
  near(p.start, 3200000 * 0.925 - p.owed0, 1);              // under the R3m exclusion: no tax
  assert.ok(Math.abs(p.months[0].ahead) < 40000);            // a month after today, close to selling today
  const w = withAndWithout({ ...own, scenarios: [{ kind: 'more', from: '2026-11', to: null, amount: 2000 }] }, TODAY);
  assert.ok(w.sooner > 0);
});

test('D-078 compare on the same money: keep or sell and rent comes out even when nothing differs', () => {
  // A paid-off home growing exactly as fast as investments after tax, no costs either way, against
  // selling it (no costs) and renting for almost nothing: the same wealth.
  const growth = 9 * 0.85;
  const own = homePlan({ kind: 'own', worthNow: 2000000, sellPct: 0, growthPct: growth, on: { bond: false, running: false, travel: false } }, TODAY);
  const rent = homePlan({ kind: 'rent', rent: 0.01, sellPrice: 2000000, owedNow: 0, agentPct: 0, coc: 0, sellPct: 0, on: { sellFirst: true, travel: false } }, TODAY);
  const s = sameMoney([own, rent], { investPct: 9, investTaxPct: 15, investShare: 100 });
  near(s.series[0][119].wealth, s.series[1][119].wealth, 200);
});

test('D-078 older saves open as the right kind', () => {
  assert.equal(kindOf({ mode: 'rent' }, 'home'), 'rent');
  assert.equal(kindOf({ rbMode: 'keep' }, 'rentbuy'), 'own');
  assert.equal(kindOf({}, 'ourbond'), 'own');
  assert.equal(kindOf({ kind: 'own' }), 'own');
  assert.equal(kindOf({}, 'bond'), 'buy');
  assert.deepEqual(homePlan({ kind: 'rent' }, TODAY).missing, ['the rent']);
});
