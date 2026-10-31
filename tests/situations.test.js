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

test('D-089 a line from the month we bought is measured; the bond each way', () => {
  // The owner's own bond: R1 000 more a month from the month it started, R100 000 taken out in 2023.
  const mine = { ...own, bondLoan: 900000, bondYears: 14, bondRate: 10.75, growthPct: 11.7, stayYears: 15,
    bondEvents: [{ kind: 'more', from: '2019-12', to: '2026-08', amount: 1000 }, { kind: 'withdraw', from: '2023-09', amount: 100000, use: 'spent' }] };
  const r = situationEffects(mine, '2026-10-31', 15 * 12 + 82);
  assert.ok(r.items.every((x) => !x.past));
  const [more, out] = r.items;
  assert.ok(more.sooner > 0 && more.interest > 0, 'paying more brought the end closer and saved interest');
  assert.ok(out.sooner < 0 && out.interest < 0, 'taking it out pushed the end back and added interest');
  assert.equal(r.bond.asIs.paidOff, '2033-05');
  assert.equal(r.bond.without['bondEvents:1'].paidOff, '2032-02');   // never took it out
  assert.equal(r.bond.none.paidOff, '2033-12');                       // the bank's own schedule
  assert.ok(r.bond.none.interest - r.bond.asIs.interest > 30000, 'both together still saved interest');
  assert.ok(r.bond.asIs.owedNow < r.bond.without['bondEvents:0'].owedNow);
  assert.ok(out.moreThanAhead > 50000 && out.moreThanAhead < 100000);
});
