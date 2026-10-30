// One home, whole (D-078): sections that can be left out, scenarios with and without,
// and any homes compared on the same money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homePlan, withAndWithout, sameMoney, kindOf } from '../js/apps/homes/home.js';
import { homeCost } from '../js/apps/finance/maths.js';

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-10-28';
const buy = { kind: 'buy', price: 1800000, deposit: 180000, ratePct: 11, termYears: 20, stayYears: 10, ratesTaxes: 1500, insurance: 600, maintMode: 'percent', upkeepPct: 1, km: 20, growthPct: 5, sellPct: 7.5, otherRatePct: 7, investPct: 7, investTaxPct: 0 };

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

test('D-087 after the bond: on the same money the instalment no longer paid is invested - no tick needed', () => {
  const short = { ...buy, termYears: 5, stayYears: 10, on: { travel: false, running: false } };
  const rent = { ...short, kind: 'rent', rent: 0.0001, rentDeposit: 0 };
  const sm = sameMoney([homePlan(short, TODAY), homePlan(rent, TODAY)], { investPct: 7, investTaxPct: 0 });
  // While the bond runs, the renter (paying next to nothing) invests the instalment each month; once it
  // is done neither needs anything, so the renter's money only grows - the instalment now stays with the owner.
  const renter = (t) => sm.series[1][t - 1].wealth;
  assert.ok(renter(48) / renter(36) > 1.2);
  near(renter(84) / renter(72), 1.07, 0.001);
  // An old saved tick changes nothing.
  near(homePlan({ ...short, on: { ...short.on, afterBond: true } }, TODAY).at.ahead, homePlan(short, TODAY).at.ahead, 0.01);
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

test('D-083 buying later: the plan starts then, and costs are a year further on', () => {
  const now = homePlan(buy, TODAY);
  const later = homePlan({ ...buy, fromMonth: '2027-10' }, TODAY);
  assert.equal(later.startYM, '2027-10');
  assert.equal(later.now, -12);
  assert.equal(later.months[0].ym, '2027-11');
  near(later.months[0].bondPaid, now.months[0].bondPaid, 0.01);
  assert.ok(later.months[0].running > now.months[0].running, 'rates and insurance have risen by then');
  near(later.stay, 120, 0);
});

test('D-083 ours from when we bought it: the whole story, landing on today as before', () => {
  const own = { kind: 'own', worthNow: 3200000, boughtFor: 1500000, boughtWhen: '2019-12', growthPct: 5, sellPct: 7.5, stayYears: 10, ratesTaxes: 1500,
    bondLoan: 900000, bondStart: '2019-12', bondYears: 20, bondRate: 10 };
  const today = homePlan(own, TODAY);
  const story = homePlan({ ...own, ownFrom: 'bought' }, TODAY);
  assert.equal(story.startYM, '2019-12');
  assert.equal(story.now, 82);
  near(story.fromPocket, 600000 + story.buyItems.reduce((s, i) => s + i.amount, 0), 1);
  near(story.months[story.now - 1].value, 3200000, 1);
  for (const t of [1, 12, 120]) near(story.months[story.now + t - 1].homeNet, today.months[t - 1].homeNet, 1);
  near(story.monthNow, today.monthNow, 0.01);
  near(story.bond.owedNow, today.bond.owedNow, 0.01);
  assert.equal(story.months.length, 360 + 82, '30 years on from today');
  // Compared with buying now: on one calendar from today; what ours cost before is behind it.
  const sm = sameMoney([story, homePlan(buy, TODAY)]);
  assert.equal(sm.align, '2026-10');
  assert.deepEqual(sm.day1.map((x) => x > 0), [false, true]);
  const smToday = sameMoney([today, homePlan(buy, TODAY)]);
  near(sm.series[0][119].wealth, smToday.series[0][119].wealth, 5);
});
