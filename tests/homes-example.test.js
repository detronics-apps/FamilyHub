// The example home from moneywithcarla's post, and "What would it take for buying to win?" (D-116).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_HOME, exampleCheck, CARLA_SAID } from '../js/apps/homes/examples.js';
import { breakEven, breakEvenWords } from '../js/apps/homes/breakeven.js';
import { PLAN_DEFAULTS } from '../js/apps/homes/home.js';

const TODAY = '2026-11-12';
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test('the post\'s figures through Family Hub: what agrees, and the differences measured, not adjusted', () => {
  const rows = Object.fromEntries(exampleCheck(EXAMPLE_HOME.values, TODAY).map((r) => [r.what, r]));
  near(rows['Bond a month'].ours, CARLA_SAID.bond, 500);                         // R103K
  near(rows['Year one, buying'].ours, CARLA_SAID.buyerYear1, 10000);              // R1,4m
  near(rows['Year one, renting'].ours, CARLA_SAID.renterYear1, 1);                // R540K exactly
  near(rows['The home after 20 years'].ours, CARLA_SAID.value20, 50000);          // R44,5m
  // The differences, as they are: duty and fees item by item; capital gains tax on the sale; a
  // monthly rate that comes to exactly 13% a year.
  near(rows['Up front: deposit, duty and fees'].ours, 2450000, 20000);
  assert.ok(rows['Buying leaves, after 20 years'].ours < CARLA_SAID.value20);
  near(rows['Renting leaves, after 20 years'].ours, 81550000, 200000);
  near(rows['Rent costs more than the buyer pays, from year'].ours, 17.1, 0.1);
});

test('what would it take: the growth, or the return, at which buying and renting come out level', () => {
  const v = { ...PLAN_DEFAULTS, ...EXAMPLE_HOME.values };
  const g = breakEven(v, TODAY, 'growthPct', 20);
  const at = (r, y) => r.rows.find((x) => x.year === y);
  near(at(g, 20).needed, 11.1, 0.3);                     // buying needs about 11% a year, against 7%
  assert.ok(at(g, 1).needed > at(g, 20).needed, 'selling early needs far more growth');
  assert.match(breakEvenWords(g, 20), /about 11\.\d% a year .* You have 7%, so renting leaves more/);
  const i = breakEven(v, TODAY, 'investPct', 20);
  assert.equal(at(i, 1).always, 'rent');                 // year one: renting wins at any return tried
  near(at(i, 20).needed, 8.4, 0.3);                      // buying wins if investments return under about 8,4%
  // Higher growth for this home moves the level point the right way: buying then wins at 20 years.
  assert.match(breakEvenWords(breakEven({ ...v, growthPct: 12 }, TODAY, 'growthPct', 20), 20), /buying leaves more/);
  assert.equal(breakEven({ ...v, likeRent: null }, TODAY, 'growthPct'), null, 'nothing to compare with yet');
});
