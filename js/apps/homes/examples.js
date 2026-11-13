// The example home every family starts with (D-116): the Oranjezicht 2-bed from moneywithcarla's
// post "Cape Town property prices? Up 11,5% in a year" (2026), with the post's own figures, so
// people can see what the page does and play with it - and remove it. Its numbers are the post's;
// what the post says it comes to is kept beside them, so the page can show the differences.
// Nothing here is changed to agree with the post. Pure - no DOM.

import { homePlan, PLAN_DEFAULTS } from './home.js';
import { alternativeOf } from './alternative.js';
import { measure } from './scenarios.js';

export const CARLA = { name: 'moneywithcarla', url: 'https://www.instagram.com/moneywithcarla/', post: 'https://www.instagram.com/p/DfSICUrDVC4/' };

export const EXAMPLE_HOME = {
  id: 'hom-example-oranjezicht',
  title: 'Oranjezicht 2-bed (example)',
  values: {
    kind: 'buy', exampleOf: 'carla',
    price: 11500000, deposit: 1150000,
    ratePct: 10.45, termYears: 20,             // "Bond R103K a month, for 20 years" - 10.45% gives R103K
    stayYears: 20,
    ratesTaxes: 14000, levies: null, insurance: null, maintMode: 'amount', maintYearly: 0, upkeepPct: 0,   // "+R14K a month: rates, levies, maintenance, insurance"
    escalatePct: 5,                            // "Running costs escalate yearly"; inflation was 5,0%
    growthPct: 7, investPct: 13, investTaxPct: 0, investShare: 100,   // "7% property growth, 13% investment return"; no tax in the post
    sellPct: 0,                                // the post compares the property's value, with no selling costs
    likeRent: 45000, rentRisePct: 7,           // "R45K/month", "rent +7% a year"
    km: null, on: { travel: false },
  },
};

/**
 * The same home on the owner's own figures (D-123): four changes from the post, to show how
 * much the answer moves with them - one snapshot does not decide buying or renting.
 */
export const OUR_EXAMPLE = {
  id: 'hom-example-oranjezicht-ours',
  title: 'Oranjezicht 2-bed (our figures)',
  values: { ...EXAMPLE_HOME.values, exampleOf: 'ours', investPct: 10, growthPct: 9, termYears: 14, stayYears: 15 },
  changes: [
    { what: 'Investments grow by', post: '13% a year', ours: '10% a year', why: 'What we see as realistic over many years. The range tests 8 to 12%.' },
    { what: 'House prices grow by', post: '7% a year', ours: '9% a year', why: 'Our own house grew 11.5% a year so far. The range tests 7 to 11%.' },
    { what: 'The bond over', post: '20 years', ours: '14 years', why: 'A shorter bond: a bigger instalment, far less interest.' },
    { what: 'Sell after', post: '20 years', ours: '15 years', why: 'A shorter stay - the answer is read in that year.' },
  ],
};

/** What the post says it comes to (2026). */
export const CARLA_SAID = {
  upfront: 2400000, bond: 103000, buyerYear1: 1400000, renterYear1: 540000,
  value20: 44500000, renter20: 87900000, rentPasses: 18,
};

/**
 * The post's results beside what Family Hub works out with the same figures (or this home's
 * figures now, if they were changed). Rows: { what, said, ours, unit } - unit 'R' or 'years'.
 */
export function exampleCheck(values, today) {
  const v = { ...PLAN_DEFAULTS, ...values };
  const p = homePlan(v, today);
  const alt = alternativeOf(v, today);
  if (p.missing || !alt.values) return [];
  const m = measure([v, alt.values], today, {}, { a: 0, b: 1 });
  const rent = m.plans[1];
  const sum = (plan, n) => plan.months.slice(0, n).reduce((s, x) => s + x.out, 0);
  const t = Math.min(240, p.months.length);
  const passes = rent.months.findIndex((x, i) => x.out > p.months[i].out);
  return [
    { what: 'Up front: deposit, duty and fees', said: CARLA_SAID.upfront, ours: p.fromPocket, unit: 'R' },
    { what: 'Bond a month', said: CARLA_SAID.bond, ours: p.bond?.minNow ?? 0, unit: 'R' },
    { what: 'Year one, buying', said: CARLA_SAID.buyerYear1, ours: sum(p, 12), unit: 'R' },
    { what: 'Year one, renting', said: CARLA_SAID.renterYear1, ours: sum(rent, 12), unit: 'R' },
    { what: 'The home after 20 years', said: CARLA_SAID.value20, ours: p.months[t - 1].value, unit: 'R' },
    { what: 'Buying leaves, after 20 years', said: CARLA_SAID.value20, ours: m.wealthA[t - 1].wealth, unit: 'R' },
    { what: 'Renting leaves, after 20 years', said: CARLA_SAID.renter20, ours: m.wealthB[t - 1].wealth, unit: 'R' },
    { what: 'Rent costs more than the buyer pays, from year', said: CARLA_SAID.rentPasses, ours: passes < 0 ? null : Math.round(((passes + 1) / 12) * 10) / 10, unit: 'years' },
  ];
}

/** Why the two differ - each reason the post's figures alone cannot show. */
export const WHY_DIFFERENT = [
  'Up front: Family Hub works out transfer duty, both attorneys, the Deeds Office and the bank’s fee item by item from the published 2026 figures; the post rounds them.',
  'Buying leaves less here than the home is worth: capital gains tax when it is sold is taken off. The post counts the property’s value.',
  'Renting - growth each month, not each year. Investments grow a little every month, and each month’s growth grows too. Family Hub uses the monthly rate that ends a year exactly 13% up: about 1.024% a month (1.01024 to the power 12 = 1.13). The quick way, 13% ÷ 12 = 1.083% a month, grown the same way ends the year 13.8% up (1.01083 to the power 12 = 1.138) - 0.8% a year more than the 13% it started from. Over 20 years R1 at 13% becomes about R11.52; at 13.8% about R13.28, some 15% more. And once rent costs more than buying, here the buyer invests the difference instead of the renter drawing down.',
  'When rent passes the buyer’s costs depends on how fast running costs rise - the post does not say; 5% is used here.',
];
