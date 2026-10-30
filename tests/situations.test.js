// What each situation did (D-087).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situationEffects, situationList, situationLabel } from '../js/apps/homes/situations.js';
import { homePlan } from '../js/apps/homes/home.js';

const TODAY = '2026-10-30';
const own = { kind: 'own', ownFrom: 'bought', worthNow: 3200000, boughtFor: 1500000, boughtWhen: '2019-12', bondLoan: 1300000, bondStart: '2019-12', bondYears: 20, bondRate: 10, stayYears: 10, sellPct: 7.5, growthPct: 6, investPct: 9, investTaxPct: 15, likeRent: 15000,
  bondEvents: [{ kind: 'more', from: '2020-01', to: '2022-12', amount: 4000 }, { kind: 'withdraw', from: '2024-03', amount: 150000 }] };

test('D-087 the list and the words', () => {
  assert.deepEqual(situationList(own).map((s) => s.key), ['bondEvents:0', 'bondEvents:1']);
  assert.equal(situationLabel(own.bondEvents[0]), 'R4 000 more a month, Jan 2020 to Dec 2022');
  assert.equal(situationLabel({ ...own.bondEvents[1], use: 'spent' }), 'R150 000 taken out, Mar 2024 (spent)');
  // An unticked what-if is not one.
  assert.equal(situationList({ ...own, scenarios: [{ kind: 'extra', from: '2027-01', amount: 1, on: false }] }).length, 2);
});

test('D-087 each one on its own, on the same money', () => {
  const r = situationEffects(own, TODAY, 120);
  const [more, out] = r.items;
  assert.ok(!more.past && more.sooner === 0 && more.interest > 0);  // paying more: less interest - the take-out later sets the end date back (the bank works the instalment out again)
  assert.ok(out.sooner < 0 && out.interest < 0);                   // taking out: later, more interest
  assert.ok(more.kept > 0 && more.keptPaidOff);                     // had it gone on: sooner still
  assert.ok(r.together && Number.isFinite(r.together.effect));
  assert.equal(more.points.length, 360);
  // Spent, the money taken out is gone: taking it out leaves you less than investing it.
  const spent = situationEffects({ ...own, bondEvents: [own.bondEvents[0], { ...own.bondEvents[1], use: 'spent' }] }, TODAY, 120);
  assert.ok(spent.items[1].effect < out.effect - 100000);
  // More taken out than had been paid ahead is flagged.
  assert.equal(out.moreThanAhead, null);               // R144 000 paid ahead, plus the interest it saved
  const big = situationEffects({ ...own, bondEvents: [{ kind: 'withdraw', from: '2024-03', amount: 900000 }] }, TODAY, 120);
  assert.ok(big.items[0].moreThanAhead != null);
});

test('D-087 from today, what happened before is not measured; a spent take-out is not money in', () => {
  const r = situationEffects({ ...own, ownFrom: 'today' }, TODAY, 120);
  assert.ok(r.items.every((x) => x.past));
  const m = (v) => homePlan(v, TODAY).months.find((x) => x.ym === '2024-03');
  assert.equal(m({ ...own, bondEvents: [{ ...own.bondEvents[1], use: 'spent' }] }).taken, 0);
  assert.equal(m({ ...own, bondEvents: [own.bondEvents[1]] }).taken, 150000);
});
