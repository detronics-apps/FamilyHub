// The scenario range (D-084): every scenario recalculated through the real model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioRange, defaultRanges, measure, relevant } from '../js/apps/homes/scenarios.js';

const TODAY = '2026-10-29';
const buy = { kind: 'buy', price: 1800000, deposit: 180000, ratePct: 11, termYears: 20, stayYears: 10, ratesTaxes: 1500, insurance: 600, maintMode: 'percent', upkeepPct: 1, growthPct: 5, sellPct: 7.5, investPct: 9 };
const rent = { kind: 'rent', rent: 14000, rentRisePct: 6, rentDeposit: 28000, stayYears: 10, investPct: 9 };

test('D-084 buy against rent: favourable, central and unfavourable, each worked out again', () => {
  const vals = [buy, rent];
  const r = scenarioRange(vals, TODAY, defaultRanges(vals), 120);
  assert.ok(r.at.favourable > r.at.central && r.at.central > r.at.unfavourable, JSON.stringify(r.at));
  // Not a band drawn around the line: the gap to the central line changes over time.
  const gap = (t) => r.unfavourable.series[t][1] - r.central.series[t][1];
  assert.notEqual(Math.round(gap(11)), Math.round(gap(119)));
  assert.ok(Math.abs(gap(119)) > Math.abs(gap(11)), 'uncertainty grows with time');
  // Each variable said which way it went in each scenario.
  assert.equal(r.favDeltas.growth, 2, 'faster house price growth favours buying');
  assert.equal(r.favDeltas.rent, 2, 'faster rent rises favour buying');
  assert.equal(r.unfDeltas.invest, 2, 'higher investment returns favour renting');
  assert.ok(r.effects[0].swing >= r.effects.at(-1).swing, 'sorted by how much they move the answer');
  assert.ok(['all-above', 'all-below', 'crosses'].includes(r.verdict));
});

test('D-084 the central line is exactly the model with nothing moved; one home uses its own ahead', () => {
  const m = measure([buy], TODAY);
  assert.equal(m.series[119][1], m.plans[0].months[119].ahead);
  const r = scenarioRange([buy], TODAY, defaultRanges([buy]), 120);
  assert.equal(r.at.central, m.series[119][1]);
  assert.deepEqual(relevant([buy]).map((x) => x.key), ['growth', 'invest', 'rate', 'costs', 'repairs']);
});

test('D-084 a variable left out of the range is not moved', () => {
  const vals = [buy, rent];
  const ranges = defaultRanges(vals);
  for (const k of Object.keys(ranges)) if (k !== 'growth') ranges[k].on = false;
  const r = scenarioRange(vals, TODAY, ranges, 120);
  assert.deepEqual(Object.keys(r.favDeltas), ['growth']);
  assert.equal(r.effects.length, 1);
});

test('D-084 can you carry it: nothing assumed - what is not given is not assessed', async () => {
  const { carryIt } = await import('../js/apps/homes/risk.js');
  const { homePlan } = await import('../js/apps/homes/home.js');
  const p = homePlan(buy, TODAY);
  const none = carryIt(buy, p, TODAY);
  assert.equal(none.factors.find((f) => f.title === 'A month, against income').level, 'unknown');
  assert.equal(none.factors.find((f) => f.title === 'Cash after moving in').level, 'unknown');
  const tight = { ...buy, income: p.monthNow / 0.45, cashNow: p.fromPocket - 10000, incomes: 'one', yearsToGoal: 5 };
  const r = carryIt(tight, p, TODAY);
  assert.equal(r.factors.find((f) => f.title === 'A month, against income').level, 'strain');
  assert.match(r.factors.find((f) => f.title === 'Cash after moving in').text, /short/);
  assert.ok(r.factors.some((f) => f.title === 'One income') && r.factors.some((f) => f.title === 'Needing the money sooner'));
  assert.ok(r.options.length > 0, 'options to consider, not instructions');
  assert.ok(r.factors.find((f) => f.title === 'If the rate rises 2 points').text.includes('more a month'));
});
