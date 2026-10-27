// Own or rent (D-072): like for like as far as it goes, with the family's own figures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownOrRent, historyGrowth, homeGainTax, evenAt, CGT } from '../js/apps/homes/ownrent.js';

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const TODAY = '2026-10-27';

test('D-072 our own home’s growth, and the tax on selling it', () => {
  // Bought for R1.5m at the end of 2019, worth R3.2m now: about 11.6% a year.
  const h = historyGrowth(1500000, '2019-12', 3200000, TODAY);
  near(h.pct, 11.7, 0.15);
  assert.equal(historyGrowth(null, '2019-12', 3200000, TODAY), null);
  // A R1.7m gain on the home you live in is under the R3m exclusion: no tax.
  assert.equal(homeGainTax(3200000, 1500000, 45).tax, 0);
  near(homeGainTax(5000000, 1000000, 45).tax, (4000000 - CGT.primaryResidence - CGT.annual) * 0.4 * 0.45);
});

test('D-072 like for like: a home growing as fast as investments, no costs, comes out even', () => {
  // R1m cash, no duty (under R1.21m), no fees or selling costs, house growth = investment growth after tax, no rent.
  const v = { price: 1000000, deposit: 1000000, fees: 0, sellPct: 0, growthPct: 9 * 0.85, investPct: 9, investTaxPct: 15, rent: 0.0001, rentRisePct: 0, stayYears: 10, escalatePct: 0 };
  const r = ownOrRent(v);
  near(r.ahead, 0, 50);
});

test('D-072 what people forget moves the answer the right way', () => {
  const base = { price: 2000000, deposit: 200000, ratePct: 11, termYears: 20, rent: 18000, rentDeposit: 18000, ratesTaxes: 1500, insurance: 600, maintYearly: 10000, stayYears: 10 };
  const r = ownOrRent(base);
  near(r.ahead, r.owner - r.renter);
  assert.equal(r.series.length, 30);
  assert.ok(r.duty > 0 && r.fees > 0);
  // An upgrade that adds more than it costs helps the owner.
  assert.ok(ownOrRent({ ...base, upgrades: [{ name: 'Bathroom', inYears: 2, cost: 30000, adds: 55000 }] }).ahead > r.ahead);
  // Rent rising faster helps the owner; investments growing faster help the renter.
  assert.ok(ownOrRent({ ...base, rentRisePct: 10 }).ahead > r.ahead);
  assert.ok(ownOrRent({ ...base, investPct: 12 }).ahead < r.ahead);
  // If the renter only invests half the difference, the renter is worse off.
  assert.ok(ownOrRent({ ...base, investShare: 50 }).renter < r.renter);
  // Maintenance as a % of the value instead of the family's own figure.
  assert.ok(ownOrRent({ ...base, maintMode: 'percent', upkeepPct: 2 }).ahead < r.ahead);
  // The even point: at that house growth, neither is ahead.
  const even = evenAt(base, 'growthPct', -5, 20);
  near(ownOrRent({ ...base, growthPct: even }).ahead, 0, 100);
});

test('D-072 keep or sell: the bond ends, the cash from selling now, and the tax', () => {
  const v = { rbMode: 'keep', worthNow: 3200000, owedNow: 300000, yearsLeft: 5, ratePct: 10.75, boughtFor: 1500000, improvedSoFar: 50000, rent: 25000, stayYears: 10 };
  const r = ownOrRent(v);
  assert.equal(r.bondEnds, 5);
  near(r.saleNow.cash, 3200000 * (1 - 0.075) - 300000, 1);      // the gain is under R3m: no tax
  assert.equal(r.saleNow.tax, 0);
  assert.ok(r.series[6].own < r.series[3].own);                 // after the bond, owning costs far less
  assert.deepEqual(ownOrRent({ rbMode: 'keep', rent: 1 }).missing, ['what the home is worth now']);
});
