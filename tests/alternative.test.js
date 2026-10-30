// What a home is compared with (D-086): never "keeping your money and paying nothing for a home".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternativeOf } from '../js/apps/homes/alternative.js';
import { homePlan } from '../js/apps/homes/home.js';
import { measure, relevant } from '../js/apps/homes/scenarios.js';

const TODAY = '2026-10-30';
const buy = { kind: 'buy', price: 1800000, deposit: 180000, ratePct: 11, termYears: 20, stayYears: 10, ratesTaxes: 1500, insurance: 600, maintYearly: 12000, growthPct: 5, sellPct: 7.5, investPct: 9, rentRisePct: 6 };
const at = (m, H) => m.series[H - 1][1];

test('D-086 buying is compared with renting a similar home - and asks for its rent first', () => {
  assert.equal(alternativeOf(buy, TODAY).values, null);
  assert.match(alternativeOf(buy, TODAY).ask, /rent for a similar home/);
  const dear = measure([buy, alternativeOf({ ...buy, likeRent: 40000 }, TODAY).values], TODAY, {}, { a: 0, b: 1 });
  const cheap = measure([buy, alternativeOf({ ...buy, likeRent: 4000 }, TODAY).values], TODAY, {}, { a: 0, b: 1 });
  assert.ok(at(dear, 120) > 0, 'dear rent: buying leaves more');
  assert.ok(at(cheap, 120) < 0, 'cheap rent: renting leaves more');
});

test('D-086 kept as cash: whoever spends less no longer earns on the difference', () => {
  const v = { ...buy, likeRent: 9000 };
  const alt = alternativeOf(v, TODAY).values;
  const invested = at(measure([v, alt], TODAY, {}, { a: 0, b: 1 }), 120);
  const cash = at(measure([{ ...v, diffCash: true }, alt], TODAY, {}, { a: 0, b: 1 }), 120);
  // Renting is cheaper each month here and keeps the deposit: it gains most from investing.
  assert.ok(cash > invested, `${cash} > ${invested}`);
});

test('D-086 ours from when we bought it: renting a similar home from then, at today\'s rent now', () => {
  const own = { kind: 'own', ownFrom: 'bought', boughtFor: 1500000, boughtWhen: '2019-12', worthNow: 2400000, bondLoan: 900000, bondStart: '2019-12', bondYears: 14, bondRate: 10.75, ratesTaxes: 1300, levies: 2900, growthPct: 5, likeRent: 15000, rentRisePct: 6, stayYears: 15, investPct: 9 };
  const p = homePlan(own, TODAY);
  const alt = alternativeOf(own, TODAY);
  assert.deepEqual(alt.names, ['Having bought it', 'Renting instead']);
  const ap = homePlan(alt.values, TODAY);
  assert.equal(ap.startYM, p.startYM, 'both from the month we bought');
  assert.ok(Math.abs(ap.months[p.now].rent - 15000) < 1, 'today\'s rent is the one typed');
  assert.ok(ap.months[0].rent < 15000, 'it was less in 2019');
  const m = measure([own, alt.values], TODAY, {}, { a: 0, b: 1 });
  assert.equal(m.sm.up - m.sm.day1[1], p.fromPocket, 'renting keeps the deposit and buying costs invested from day one');
});

test('D-086 ours, from today: against selling today and renting', () => {
  const own = { kind: 'own', worthNow: 2400000, ratesTaxes: 1300, growthPct: 5, likeRent: 15000, stayYears: 10, investPct: 9 };
  const alt = alternativeOf(own, TODAY);
  assert.deepEqual(alt.names, ['Keeping it', 'Selling and renting']);
  const ap = homePlan(alt.values, TODAY);
  assert.ok(ap.inv0 > 2000000, 'the sale is invested while renting');
});

test('D-086 renting is compared with buying a similar home - and asks for its price first', () => {
  const rent = { kind: 'rent', rent: 14000, rentRisePct: 6, stayYears: 10, investPct: 9 };
  assert.match(alternativeOf(rent, TODAY).ask, /cost to buy/);
  const alt = alternativeOf({ ...rent, price: 1800000, deposit: 180000, ratePct: 11, termYears: 20 }, TODAY);
  assert.equal(alt.values.kind, 'buy');
  assert.ok(measure([{ ...rent, price: 1800000 }, alt.values], TODAY, {}, { a: 0, b: 1 }));
});

test('D-086 repairs are tested only when there is a figure: 50% more than nothing is nothing', () => {
  assert.ok(relevant([{ ...buy, maintYearly: 0 }]).every((x) => x.key !== 'repairs'));
  assert.ok(relevant([buy]).some((x) => x.key === 'repairs'));
  assert.ok(relevant([{ ...buy, maintYearly: 0, maintMode: 'percent', upkeepPct: 1 }]).some((x) => x.key === 'repairs'));
});
