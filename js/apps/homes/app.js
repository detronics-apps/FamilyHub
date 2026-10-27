// Homes (D-067): a bond on its own, the true cost of living in one home (bought or
// rented, with the trip to work), and renting against buying the same home. The
// three share their inputs, so a price typed once is there in all of them.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { homeCost, bond, transferDuty, feesEstimate, HOME_DEFAULTS, REFERENCE, sensitivity, monthlyRate } from '../finance/maths.js';
import { ownOrRent, evenAt, historyGrowth, OWN_RENT_DEFAULTS, CGT } from './ownrent.js';
import { levelBar, shows, draft, loadDraft, inputsPanel, assumed, stat, sums, step, lineChart, savedPanel, compareTable, rand, pct, months } from '../finance/pod.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'hom' });
// Own or rent adds its own fields; where both have one (price, rent...) the home's default is kept, so they share it.
const DEFAULTS = { ...OWN_RENT_DEFAULTS, ...HOME_DEFAULTS, extra: null, income: null };
const D = () => draft('homes', DEFAULTS);
const buying = (v) => v.mode !== 'rent';
const renting = (v) => v.mode === 'rent';

const TERMS = [20, 25, 30].map((y) => ({ value: y, label: `${y} years` }));
const F = {
  mode: { key: 'mode', label: 'This home', type: 'choice', level: 'simple', redraw: true, choices: [{ value: 'buy', label: 'Buy' }, { value: 'rent', label: 'Rent' }] },
  price: { key: 'price', label: 'Price', type: 'money', level: 'simple' },
  deposit: { key: 'deposit', label: 'Deposit', type: 'money', level: 'simple', source: { kind: 'assumption' } },
  ratePct: { key: 'ratePct', label: 'Interest rate', type: 'percent', level: 'simple', source: { ref: REFERENCE.prime }, hint: 'The rate the bank offers you. Home loans are often near prime, and move when prime moves.' },
  termYears: { key: 'termYears', label: 'Bond over', type: 'choice', level: 'simple', choices: TERMS },
  rent: { key: 'rent', label: 'Rent a month', type: 'money', level: 'simple' },
  rentDeposit: { key: 'rentDeposit', label: 'Rental deposit', type: 'money', level: 'simple', optional: true, hint: 'Usually one or two months’ rent. You get it back when you leave, so it is cash needed - not a cost.' },
  stayYears: { key: 'stayYears', label: 'Live here for', type: 'years', level: 'simple', source: { kind: 'assumption' }, hint: 'How long you expect to stay - for example, while you work at this job.' },
  ratesTaxes: { key: 'ratesTaxes', label: 'Rates and taxes a month', type: 'money', level: 'simple', optional: true },
  levies: { key: 'levies', label: 'Levies a month', type: 'money', level: 'simple', optional: true, hint: 'In a complex or estate.' },
  insurance: { key: 'insurance', label: 'Building insurance a month', type: 'money', level: 'simple', optional: true },
  upkeepPct: { key: 'upkeepPct', label: 'Upkeep and repairs, of the value a year', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'Roofs, geysers, paint, gardens. About 1% of the value a year is a common rule of thumb.' },
  escalatePct: { key: 'escalatePct', label: 'Costs rise by', type: 'percent', level: 'advanced', source: { ref: REFERENCE.cpi }, hint: 'Rates, levies, insurance and travel, each year.' },
  km: { key: 'km', label: 'Distance to work, one way', type: 'kmOne', level: 'simple', optional: true },
  minutes: { key: 'minutes', label: 'Time to get there, one way', type: 'minutes', level: 'simple', optional: true },
  days: { key: 'days', label: 'Days at work a month', type: 'number', level: 'advanced', source: { kind: 'assumption' } },
  perKm: { key: 'perKm', label: 'Cost per km', type: 'money', level: 'advanced', source: { ref: REFERENCE.perKm }, hint: 'Covers fuel, wear and the car losing value. Fuel alone is less; use your own figure if you prefer.' },
  travelExtra: { key: 'travelExtra', label: 'Tolls, parking or taxi fares a month', type: 'money', level: 'advanced', optional: true },
  hourValue: { key: 'hourValue', label: 'What an hour of your time is worth', type: 'money', level: 'advanced', optional: true, hint: 'Optional. Shown beside the money, never added to it.' },
  fees: { key: 'fees', label: 'Attorney, bond and deeds office fees', type: 'money', level: 'advanced', source: { kind: 'illustrative' }, estimate: (v) => feesEstimate(Number(v.price) || 0, (Number(v.price) || 0) - (Number(v.deposit) || 0)), hint: 'Left empty: a rough estimate. Ask a conveyancer for the real figure.' },
  moveCost: { key: 'moveCost', label: 'Moving in', type: 'money', level: 'advanced', optional: true, hint: 'Removals, connecting services, things the new place needs.' },
  growthPct: { key: 'growthPct', label: 'House prices grow by', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'Not a promise: prices can stall or fall, and differ by area.' },
  sellPct: { key: 'sellPct', label: 'Selling costs, of the price', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'Agent’s commission (often 5 to 7.5% plus VAT) and other costs of selling.' },
  rentRisePct: { key: 'rentRisePct', label: 'Rent rises by', type: 'percent', level: 'advanced', source: { kind: 'illustrative' } },
  otherRatePct: { key: 'otherRatePct', label: 'Money could earn elsewhere', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'What money paid up front could have grown by if it had been saved instead.' },
  income: { key: 'income', label: 'Household income a month, before tax', type: 'money', level: 'simple', optional: true },
  extra: { key: 'extra', label: 'Pay extra each month', type: 'money', level: 'advanced', optional: true },
};
const pick = (keys, extra = {}) => keys.map((k) => ({ ...F[k], ...(extra[k] ?? {}) }));

export function render(hub, route) {
  if (route.sub === 'home') return homeScreen(hub);
  if (route.sub === 'bond') return bondScreen(hub);
  if (route.sub === 'rentbuy') return rentBuyScreen(hub);
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  return el('section', { class: 'stack', 'aria-labelledby': 'homes-title' }, [
    el('h1', { id: 'homes-title', text: 'Homes', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Buying, renting, and one home against another. What you type in one is already there in the others.' }),
    el('ul', { class: 'list panel' }, [
      ['home', 'A home', 'What will living here really cost - the trip to work included? Save each one and compare.'],
      ['bond', 'Bond', 'What will the bond cost each month, and in total - and what is needed up front?'],
      ['rentbuy', 'Own or rent', 'Buying against renting, or keeping our home against selling and renting - with what people forget.'],
    ].map(([id, title, q]) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href(id), 'data-field': `tool:${id}`, style: { color: 'inherit', textDecoration: 'none' } }, [el('strong', { text: title }), el('div', { class: 'small muted', text: q })]),
      el('a', { class: 'btn btn-small', href: hub.href(id), text: 'Open' }),
    ]))),
  ]);
}

/** One tool's page: the question, the level bar, the inputs, the answer, and saving. */
function page(hub, { id, title, intro, fields, groups, kind, results, headline }) {
  const d = D();
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...results(d).filter(Boolean));
  const changed = (key) => (fields.find((f) => f.key === key)?.redraw ? hub.render() : refresh());
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': id }, [
    el('h1', { id, text: title, style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: intro }),
    levelBar(() => hub.render()),
    inputsPanel(fields, d, groups, changed),
    answer,
    savedPanel(hub, {
      col: col(hub), kind, d, compareScreen: 'compare',
      summary: () => ({ headline: headline(d.values) }),
      onOpen: (rec) => { loadDraft('homes', DEFAULTS, rec); hub.go(rec.kind); },
    }),
  ]);
}

const nothing = (r) => (r.missing ? [el('p', { class: 'panel muted', text: `Fill in ${r.missing.join(' and ')} to see the answer.` })] : r.error ? [el('p', { class: 'panel', role: 'alert', text: r.error })] : null);
const said = (title, lines) => el('div', { class: 'panel stack' }, [el('h2', { text: title, style: { margin: 0 } }), ...lines.filter(Boolean).map((t) => (typeof t === 'string' ? el('p', { style: { margin: 0 }, text: t }) : t))]);
const list = (title, items) => (items.length ? el('div', { class: 'panel stack' }, [el('h2', { text: title, style: { margin: 0 } }), el('ul', { style: { margin: 0 } }, items.map((t) => el('li', { text: t })))]) : null);
const leavesOut = (items) => [el('h3', { text: 'What this leaves out', style: { margin: 0 } }), el('ul', { class: 'small', style: { margin: 0 } }, items.map((t) => el('li', { text: t })))];
const signed = (n) => `${n > 0 ? '+' : '−'}${rand(Math.abs(n))}`;

/* --------------------------------------------------------------- a home */

const HOME_FIELDS = pick(['mode', 'price', 'deposit', 'ratePct', 'termYears', 'rent', 'rentDeposit', 'stayYears', 'km', 'minutes', 'days', 'perKm', 'travelExtra', 'hourValue',
  'ratesTaxes', 'levies', 'insurance', 'upkeepPct', 'escalatePct', 'fees', 'moveCost', 'growthPct', 'sellPct', 'rentRisePct', 'otherRatePct'])
  .map((f) => ({
    ...f,
    group: ['km', 'minutes', 'days', 'perKm', 'travelExtra', 'hourValue'].includes(f.key) ? 'travel'
      : ['ratesTaxes', 'levies', 'insurance', 'upkeepPct', 'escalatePct'].includes(f.key) ? 'running'
        : ['fees', 'moveCost', 'growthPct', 'sellPct', 'rentRisePct', 'otherRatePct'].includes(f.key) ? 'more' : undefined,
    when: ['price', 'deposit', 'ratePct', 'termYears', 'ratesTaxes', 'levies', 'insurance', 'upkeepPct', 'fees', 'growthPct', 'sellPct'].includes(f.key) ? buying
      : ['rent', 'rentDeposit', 'rentRisePct'].includes(f.key) ? renting : undefined,
  }));
const HOME_GROUPS = { travel: 'Getting to work', running: 'Owning it (optional)', more: 'Moving, selling and growth' };
const homeHeadline = (v) => { const c = homeCost(v); return c.total == null ? '' : `${v.mode === 'rent' ? 'Rent' : 'Buy'} · ${rand(c.monthNow)} a month · ${rand(c.total)} over ${months(c.months)}`; };

function homeScreen(hub) {
  return page(hub, {
    id: 'home-title', title: 'What will living here really cost?', kind: 'home', headline: homeHeadline,
    intro: 'Bought or rented, with the trip to work counted. Save each home with a name - "Closer to work", "Bigger garden" - and compare them.',
    fields: HOME_FIELDS, groups: HOME_GROUPS, results: homeResults,
  });
}

function homeResults(d) {
  const v = d.values;
  const c = homeCost(v);
  const stop = nothing(c);
  if (stop) return stop;
  const stay = months(c.months);
  const trip = c.travel > 0 || c.hours > 0;
  const lines = c.buy ? [
    `Moving in takes ${rand(c.upfront)}: the ${rand(c.deposit)} deposit, ${rand(c.duty)} transfer duty, ${rand(c.fees)} attorney and bond fees${v.fees == null ? ' (a rough estimate)' : ''}${c.move ? ` and ${rand(c.move)} to move` : ''}.`,
    c.loan > 0 ? `The bond is ${rand(c.instalment)} a month for ${months(c.termMonths)}.` : null,
    `Leaving after ${stay}: the home might sell for about ${rand(c.value)}. After ${rand(c.sellCosts)} selling costs and the ${rand(c.owed)} still owed on the bond, about ${rand(c.back)} comes back.`,
    c.months <= 36 ? `For a stay this short, transfer duty, fees and selling costs (${rand(c.duty + c.fees + c.sellCosts)}) are a big part of the cost. Rent or buy shows the same home rented.` : null,
  ] : [
    `Moving in takes ${rand(c.upfront)}${c.rentDeposit ? ` - the ${rand(c.rentDeposit)} deposit comes back when you leave` : ''}.`,
    `Rent starts at ${rand(Number(v.rent))} a month and rises about ${pct(Number(v.rentRisePct) || 0)} a year: ${rand(c.rent)} over ${stay}.`,
  ];
  if (trip) lines.push(`Getting to work: about ${rand(c.travelNow)} a month${c.hoursMonth ? ` and ${Math.round(c.hoursMonth)} hours on the road` : ''}${c.timeCost ? ` (your time valued at ${rand(c.timeCost / c.months)} a month - shown, not added)` : ''}.`);
  else lines.push('The trip to work is not counted yet. Add the distance to compare homes nearer and further from work.');

  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(c.monthNow), trip ? 'a month now, with travel' : 'a month now', 'r-month-now'),
      stat(rand(c.total), `total cost of living here for ${stay}`, 'r-total'),
      stat(rand(c.upfront), 'cash needed to move in', 'r-upfront'),
    ]),
    said('What it means', [
      ...lines,
      sums([
        { label: 'Paid up front', value: c.upfront },
        c.buy ? { label: 'Paid to the bank', value: c.toBank } : null,
        c.buy ? { label: 'Rates, levies, insurance and upkeep', value: c.running } : { label: 'Rent', value: c.rent },
        { label: 'Getting to work', value: trip ? c.travel : 'not entered' },
        { label: c.buy ? 'Less what the sale brings back' : 'Less the deposit back', value: -c.back },
        { label: 'What the money up front could have earned', value: c.forgone, note: `At ${pct(Number(v.otherRatePct) || 0)} a year` },
        { label: `Total cost of living here for ${stay}`, value: c.total, total: true, note: `About ${rand(c.perMonth)} a month, all in` },
      ]),
      c.buy ? el('h3', { text: 'Where the cost goes', style: { margin: 0 } }) : null,
      c.buy ? sums([
        { label: c.valueChange >= 0 ? 'Drop in value' : 'Gain in value', value: c.valueChange },
        { label: 'Transfer duty', value: c.duty, note: REFERENCE.transferDuty.source },
        { label: 'Attorney, bond and deeds office fees', value: c.fees },
        c.move ? { label: 'Moving', value: c.move } : null,
        { label: 'Selling costs', value: c.sellCosts },
        { label: 'Bond interest', value: c.interest },
        { label: 'Rates, levies, insurance and upkeep', value: c.running },
        { label: 'Getting to work', value: c.travel },
        { label: 'What the money up front could have earned', value: c.forgone },
        { label: 'Total', value: c.total, total: true, note: 'The same total, counted the other way. Repaying the bond’s capital is paying for the house, not a cost on top of it.' },
      ]) : null,
    ]),
    assumed(HOME_FIELDS, d),
    list('What would change it', homeLevers(v, c)),
  ];
  if (shows('advanced')) out.push(homeAdvanced(v, c));
  if (shows('learn')) out.push(homeLearn(v, c));
  return out;
}

function homeLevers(v, c) {
  const tries = [];
  const longer = homeCost({ ...v, stayYears: (Number(v.stayYears) || 0) + 3 });
  tries.push(`Staying 3 years longer: ${rand(longer.perMonth)} a month all in, against ${rand(c.perMonth)}.`);
  if (Number(v.km) > 0) {
    const closer = homeCost({ ...v, km: Math.max(0, Number(v.km) - 10) });
    tries.push(`Living 10 km closer to work: about ${rand((c.travel - closer.travel) / c.months)} a month less on travel${Number(v.minutes) > 0 ? ', and time back' : ''}.`);
  }
  if (c.buy && c.loan > 0) {
    const more = Math.round(c.price * 0.1);
    const t = homeCost({ ...v, deposit: (Number(v.deposit) || 0) + more });
    tries.push(`${rand(more)} more deposit: the bond ${rand(c.instalment - t.instalment)} less a month.`);
  }
  return tries;
}

const HOME_NUDGES = [
  { key: 'growthPct', what: 'house prices growing 2 points slower', to: (x) => (Number(x) || 0) - 2 },
  { key: 'ratePct', what: 'the interest rate 1 point higher', to: (x) => (Number(x) || 0) + 1 },
  { key: 'rentRisePct', what: 'rent rising 2 points faster', to: (x) => (Number(x) || 0) + 2 },
  { key: 'perKm', what: 'travel costing 20% more', to: (x) => (Number(x) || 0) * 1.2 },
  { key: 'sellPct', what: 'selling costs 2 points higher', to: (x) => (Number(x) || 0) + 2 },
  { key: 'escalatePct', what: 'costs rising 2 points faster', to: (x) => (Number(x) || 0) + 2 },
  { key: 'otherRatePct', what: 'money elsewhere earning 2 points more', to: (x) => (Number(x) || 0) + 2 },
];

function homeAdvanced(v, c) {
  const sens = sensitivity(v, (x) => homeCost(x).total, HOME_NUDGES).filter((x) => Math.abs(x.change) >= 1);
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Over time', style: { margin: 0 } }),
    lineChart([{ name: 'Cost so far, if you left that month', points: c.timeline.map((t) => [t.month, t.cost]) }], { label: 'The cost of living here so far, if you left that month' }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: c.buy ? 'Buying starts high - duty, fees and selling costs are paid however short the stay - then grows more slowly.' : 'Renting grows steadily with the rent.' }),
    sens.length ? el('h3', { text: 'What moves the answer most', style: { margin: 0 } }) : null,
    sens.length ? el('ul', { style: { margin: 0 } }, sens.map((x) => el('li', { text: `${x.what[0].toUpperCase()}${x.what.slice(1)}: ${signed(x.change)}` }))) : null,
  ]);
}

function homeLearn(v, c) {
  const r = monthlyRate(v.ratePct);
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    c.buy ? step('Transfer duty', 'SARS bands: 0% up to R1 210 000, then 3%, 6%, 8%, 11% and 13% on the value in each band', `On ${rand(c.price)}: ${rand(transferDuty(c.price))}`, `${REFERENCE.transferDuty.source}. Paid by the buyer, in cash, before transfer.`) : null,
    c.buy && c.loan > 0 ? step('The bond instalment', 'P = L × r ÷ (1 − (1+r)^−n)', `${rand(c.loan)} × ${(r * 100).toFixed(4)}% ÷ (1 − (1+${(r * 100).toFixed(4)}%)^−${c.termMonths}) = ${rand(c.instalment)}`, 'L is the bond, r the yearly rate ÷ 12, n the months.') : null,
    c.buy ? step('The value when you leave', 'Value = price × (1 + growth)^years', `${rand(c.price)} × (1 + ${pct(Number(v.growthPct) || 0)})^${(c.months / 12).toFixed(2)} = ${rand(c.value)}`, 'The most uncertain number here: prices can stall or fall.') : null,
    c.buy ? null : step('Rent', 'Rent each month in year y = first rent × (1 + rise)^(y − 1)', `${rand(Number(v.rent))} a month, rising ${pct(Number(v.rentRisePct) || 0)} a year: ${rand(c.rent)} over ${months(c.months)}`, 'The rental deposit is cash needed to move in, but it comes back - so it is not counted as a cost, only what it could have earned meanwhile.'),
    step('Getting to work', 'Travel a month = 2 × distance × days × cost per km + tolls and parking', `2 × ${Number(v.km) || 0} km × ${Number(v.days) || 0} days × ${rand(Number(v.perKm) || 0)} = ${rand(c.travelNow)} this year, rising ${pct(Number(v.escalatePct) || 0)} a year`),
    step('What the money up front could have earned', 'Up front × ((1 + rate)^years − 1)', `${rand(c.upfront)} × ((1 + ${pct(Number(v.otherRatePct) || 0)})^${(c.months / 12).toFixed(2)} − 1) = ${rand(c.forgone)}`, 'Money tied up in a deposit, duty and fees cannot grow elsewhere. Counting it keeps buying and renting, and a big deposit and a small one, fair to each other.'),
    step('Total', 'Up front + bank + running costs (or rent) + travel − what comes back + earnings given up', `${rand(c.total)}`),
    ...leavesOut([
      'The rate is held steady; bonds linked to prime move when it does.',
      'Money paid later is counted the same as money paid now, apart from the earnings given up on money paid up front.',
      'Tax: capital gains on a home you live in are usually exempt up to a limit; nothing here counts tax.',
      'Differences between the homes themselves - space, safety, schools - are yours to weigh. Note them in the name you save it under.',
    ]),
  ]);
}

/* ----------------------------------------------------------------- bond */

const BOND_FIELDS = pick(['price', 'deposit', 'ratePct', 'termYears', 'income', 'fees', 'extra']).map((f) => ({ ...f, group: ['fees', 'extra'].includes(f.key) ? 'more' : undefined }));
const bondHeadline = (v) => { const b = bond(v); return b.instalment == null ? '' : `${rand(b.instalment)} a month · ${rand(b.cashFirst)} up front`; };

function bondScreen(hub) {
  return page(hub, {
    id: 'bond-title', title: 'What will the bond cost?', kind: 'bond', headline: bondHeadline,
    intro: 'The instalment, the interest over the years, and the cash needed before you move in.',
    fields: BOND_FIELDS, groups: { more: 'Fees and paying extra' }, results: bondResults,
  });
}

function bondResults(d) {
  const v = d.values;
  const b = bond(v);
  const stop = nothing(b);
  if (stop) return stop;
  const rates = [-1, 0, 1, 2].map((dp) => ({ dp, b: bond({ ...v, ratePct: (Number(v.ratePct) || 0) + dp }) }));
  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(b.instalment), 'instalment a month', 'r-instalment'),
      stat(rand(b.cashFirst), 'cash needed first', 'r-cash'),
      stat(rand(b.interest), `interest over ${months(b.termMonths)}`, 'r-interest'),
    ]),
    said('What it means', [
      `Borrowing ${rand(b.loan)}, you pay back ${rand(b.totalPaid)} in all - ${rand(b.interest)} of it interest${b.loan ? `, about ${(b.totalPaid / b.loan).toFixed(1)} times what was borrowed` : ''}.`,
      `Before the bond is registered you need ${rand(b.cashFirst)}: the ${rand(b.deposit)} deposit, ${rand(b.duty)} transfer duty and about ${rand(b.fees)} in attorney and bond fees${v.fees == null ? ' (a rough estimate - ask a conveyancer)' : ''}.`,
      b.share != null ? `The instalment is ${Math.round(b.share * 100)}% of the household’s income before tax.` : null,
      `Banks often look for the instalment to be no more than about 30% of gross income - here about ${rand(b.incomeGuide)} a month. Each bank decides for itself.`,
      sums(rates.map(({ dp, b: x }) => ({ label: dp === 0 ? `At ${pct(Number(v.ratePct))} (now)` : `If the rate ${dp > 0 ? 'rises' : 'falls'} ${Math.abs(dp)} point${Math.abs(dp) === 1 ? '' : 's'}`, value: x.instalment, total: dp === 0 }))),
    ]),
    assumed(BOND_FIELDS, d),
    list('What would change it', [
      ...[500, 1000, 2000].map((x) => { const e = bond({ ...v, extra: x }); return `Paying ${rand(x)} extra a month: paid off in ${months(e.monthsWithExtra)} instead of ${months(b.termMonths)}, ${rand(b.interest - e.interestWithExtra)} less interest.`; }),
      (() => { const t = bond({ ...v, termYears: Number(v.termYears) === 30 ? 20 : 30 }); return `Over ${months(t.termMonths)} instead: ${rand(t.instalment)} a month, ${rand(t.interest)} interest in all.`; })(),
    ]),
  ];
  if (shows('advanced')) {
    out.push(el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What is still owed', style: { margin: 0 } }),
      lineChart([
        { name: 'As planned', points: bond({ ...v, extra: 0 }).yearly.map((y) => [y.month, y.balance]) },
        ...(b.extra ? [{ name: `Paying ${rand(b.extra)} extra`, points: b.yearly.map((y) => [y.month, y.balance]), dashed: true }] : []),
      ], { label: 'The bond balance over the years' }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Early on most of each instalment is interest, so the balance falls slowly at first.' }),
      b.extra ? el('p', { style: { margin: 0 }, text: `With ${rand(b.extra)} extra a month: paid off in ${months(b.monthsWithExtra)}, ${rand(b.interest - b.interestWithExtra)} less interest.` }) : null,
    ]));
  }
  if (shows('learn')) {
    out.push(el('div', { class: 'panel stack fin-learn' }, [
      el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
      step('The instalment', 'P = L × r ÷ (1 − (1+r)^−n)', `${rand(b.loan)} × ${(b.r * 100).toFixed(4)}% ÷ (1 − (1+${(b.r * 100).toFixed(4)}%)^−${b.termMonths}) = ${rand(b.instalment)}`, 'L is the bond, r the yearly rate ÷ 12, n the months. Each month the interest is worked out on what is still owed, and the rest of the instalment pays it down.'),
      step('Interest', 'Interest = instalment × months − bond', `${rand(b.instalment)} × ${b.termMonths} − ${rand(b.loan)} = ${rand(b.interest)}`),
      step('Transfer duty', '0% up to R1 210 000; then 3%, 6%, 8%, 11% and 13% on the value in each band', `${rand(b.duty)}`, REFERENCE.transferDuty.source),
      step('Fees, when none are entered', 'R10 000 + 1.2% of the price, plus R10 000 + 1% of the bond', `${rand(feesEstimate(b.price, b.loan))}`, 'A rough illustrative estimate of transfer and bond registration costs, not the legal tariff - a conveyancer’s quote replaces it.'),
      step('Paying extra', 'Each month: owed = owed × (1 + r) − (instalment + extra), until nothing is owed', `${months(b.monthsWithExtra)}`, 'Every extra rand saves the interest it would have attracted for the rest of the bond. Some banks let you take extra payments back out; check yours.'),
      ...leavesOut(['The rate is held steady for the whole bond.', 'Bond insurance, initiation and monthly bank fees are not included unless you add them to the fees.']),
    ]));
  }
  return out;
}

/* ---------------------------------------------------------- rent or buy */

// Own or rent (D-072): buying against renting, or keeping the home we own against
// selling it and renting - with the family's own figures and what people forget.
const buyingRB = (v) => v.rbMode !== 'keep';
const keepingRB = (v) => v.rbMode === 'keep';
const RB_FIELDS = [
  { key: 'rbMode', label: 'We are', type: 'choice', level: 'simple', redraw: true, choices: [{ value: 'buy', label: 'Buying' }, { value: 'keep', label: 'Owners already' }] },
  { ...F.price, label: 'Price of the home', when: buyingRB },
  { ...F.deposit, when: buyingRB },
  { key: 'worthNow', label: 'What our home would sell for now', type: 'money', level: 'simple', when: keepingRB, hint: 'Ask an agent, or look at what similar homes nearby sold for.' },
  { key: 'owedNow', label: 'Still owed on the bond', type: 'money', level: 'simple', when: keepingRB, source: { kind: 'assumption' } },
  { key: 'yearsLeft', label: 'Years left on the bond', type: 'years', level: 'simple', when: keepingRB, source: { kind: 'assumption' } },
  { ...F.ratePct, label: 'Bond interest rate' },
  { ...F.termYears, when: buyingRB },
  { ...F.rent, label: 'Rent for the place we would rent, a month' },
  { key: 'rentRisePct', label: 'Rent rises by', type: 'percent', level: 'simple', source: { kind: 'illustrative' }, hint: 'Look at what the rent did over the last few years - many rents rise faster than inflation.' },
  { ...F.stayYears, label: 'Compare after', hint: 'How long you expect to live there. Who comes out ahead often changes with time.' },
  { key: 'growthPct', label: 'House prices grow by', type: 'percent', level: 'simple', group: 'own', source: { kind: 'illustrative' }, hint: 'Not a promise: prices can stall or fall, and differ by area and street. Fill in "Our own home" below to see what yours has done.' },
  { key: 'maintYearly', label: 'Maintenance and repairs a year - what you really spend', type: 'money', level: 'simple', optional: true, group: 'own', when: (v) => v.maintMode !== 'percent', hint: 'Not upgrades - those are below. Many calculators assume 1 to 2% of the value a year; your own figure is better.' },
  { key: 'maintMode', label: 'Maintenance as', type: 'choice', level: 'advanced', redraw: true, group: 'own', choices: [{ value: 'amount', label: 'Our figure' }, { value: 'percent', label: 'Percentage' }] },
  { ...F.upkeepPct, group: 'own', when: (v) => v.maintMode === 'percent' },
  { ...F.ratesTaxes, group: 'own' }, { ...F.levies, group: 'own' }, { ...F.insurance, group: 'own' },
  { ...F.sellPct, group: 'own' },
  { ...F.fees, group: 'own', when: buyingRB },
  { ...F.moveCost, label: 'Moving in', group: 'own', when: buyingRB },
  { key: 'improvedSoFar', label: 'Spent on improvements so far', type: 'money', level: 'advanced', optional: true, group: 'own', when: keepingRB, hint: 'Upgrades already done (not repairs). They count against the gain when you sell.' },
  { key: 'marginalPct', label: 'Your income tax rate on the last rand', type: 'percent', level: 'advanced', group: 'own', source: { kind: 'illustrative' }, hint: 'Only used if the gain on the home is above R3 million.' },
  { key: 'boughtFor', label: 'We bought our home for', type: 'money', level: 'simple', optional: true, group: 'history' },
  { key: 'boughtWhen', label: 'In', type: 'month', level: 'simple', optional: true, group: 'history' },
  { key: 'worthNow', label: 'It would sell for now', type: 'money', level: 'simple', optional: true, group: 'history', when: buyingRB },
  { ...F.rentDeposit, group: 'rentside' },
  { key: 'rentMove', label: 'Moving into the rented place', type: 'money', level: 'advanced', optional: true, group: 'rentside' },
  { key: 'travelOwn', label: 'Getting to work from the home we own or buy, a month', type: 'money', level: 'advanced', optional: true, group: 'travel', hint: 'Homes › A home works this out from the distance.' },
  { key: 'travelRent', label: 'Getting to work from the rented place, a month', type: 'money', level: 'advanced', optional: true, group: 'travel' },
  { key: 'investPct', label: 'Investments grow by, before tax', type: 'percent', level: 'simple', group: 'money', source: { kind: 'illustrative' }, hint: 'After fees. A money-market account pays less; shares have averaged more, with bad years in between.' },
  { key: 'investShare', label: 'Of the money saved each month, really invested', type: 'percent', level: 'simple', group: 'money', source: { kind: 'assumption' }, hint: 'Renting only builds wealth if the difference is invested, every month. Be honest: 100% is rare.' },
  { key: 'investTaxPct', label: 'Share of investment growth lost to tax', type: 'percent', level: 'advanced', group: 'money', source: { kind: 'illustrative' }, hint: 'Interest is taxed as income; gains and dividends less. A tax-free savings account loses none, up to its limits.' },
  { ...F.escalatePct, group: 'money' },
];
const RB_GROUPS = { own: 'Owning', history: 'Our own home - what has it done?', rentside: 'Renting', travel: 'Getting to work', money: 'Investing the difference' };
const rbHeadline = (v) => { const r = ownOrRent(v); return r.ahead == null ? '' : `After ${r.year} years ${r.ahead >= 0 ? 'owning' : 'renting'} ahead by ${rand(Math.abs(r.ahead))}`; };

function rentBuyScreen(hub) {
  const d = D();
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...rbResults(hub, d).filter(Boolean));
  const changed = (key) => (RB_FIELDS.find((f) => f.key === key)?.redraw ? hub.render() : refresh());
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'rb-title' }, [
    el('h1', { id: 'rb-title', text: 'Own or rent?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'It depends on the situation - so put in yours. Buying a home against renting one, or keeping the home you own against selling it and renting. Both sides have the same money each month; whoever pays less invests the difference.' }),
    levelBar(() => hub.render()),
    inputsPanel(RB_FIELDS, d, RB_GROUPS, changed),
    upgradesPanel(d, refresh),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: 'rentbuy', d, compareScreen: 'compare',
      summary: () => ({ headline: rbHeadline(d.values) }),
      onOpen: (rec) => { loadDraft('homes', DEFAULTS, rec); hub.go('rentbuy'); },
    }),
  ]);
}

/** Upgrades the owner plans: what each costs, when, and what it adds to the selling price. */
function upgradesPanel(d, refresh) {
  const list = Array.isArray(d.values.upgrades) ? d.values.upgrades : (d.values.upgrades = []);
  const box = el('div', { class: 'stack' });
  const save = () => { d.values.upgrades = list.filter((u) => u.name || u.cost); d.mine.add('upgrades'); refresh(); };
  const numIn = (u, k, label, w = '130px') => el('input', { class: 'input', type: 'number', min: '0', step: 'any', value: u[k] ?? '', 'aria-label': label, style: { maxWidth: w }, on: { change: (e) => { u[k] = e.target.value === '' ? null : Number(e.target.value); save(); } } });
  const draw = () => box.replaceChildren(...list.map((u, i) => el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' }, 'data-field': `upgrade:${i}` }, [
    el('input', { class: 'input', value: u.name ?? '', placeholder: 'e.g. New bathroom', 'aria-label': 'Upgrade', style: { flex: '1 1 160px' }, on: { change: (e) => { u.name = e.target.value; save(); } } }),
    el('span', { class: 'small muted', text: 'in' }), numIn(u, 'inYears', 'In how many years', '70px'), el('span', { class: 'small muted', text: 'years · costs R' }),
    numIn(u, 'cost', 'What it costs'), el('span', { class: 'small muted', text: '· adds R' }), numIn(u, 'adds', 'What it adds to the selling price'),
    el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${u.name || 'upgrade'}`, on: { click: () => { list.splice(i, 1); draw(); save(); } } }),
  ])));
  draw();
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Upgrades (owning only)', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'A new bathroom or kitchen can add more to the selling price than it costs - something a renter cannot do. Put in what an agent says it would add; if unsure, the same as it costs.' }),
    box,
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add upgrade', 'data-field': 'upgrade-add', on: { click: () => { list.push({ name: '', inYears: 1, cost: null, adds: null }); draw(); } } })]),
  ]);
}

function rbResults(hub, d) {
  const v = d.values;
  const today = hub.today();
  const r = ownOrRent(v);
  const hist = historyGrowth(v.boughtFor, v.boughtWhen, v.worthNow, today);
  const histLine = hist ? el('div', { class: 'panel panel--soft row', 'data-field': 'history' }, [
    el('p', { style: { margin: 0, flex: '1 1 260px' }, text: `Our own home: ${rand(Number(v.boughtFor))} in ${v.boughtWhen.slice(0, 4)} to ${rand(Number(v.worthNow))} now is about ${pct(hist.pct, 1)} a year over ${hist.years.toFixed(1)} years${Math.abs(hist.pct - Number(v.growthPct)) > 0.05 ? ` - the calculation is using ${pct(Number(v.growthPct), 1)}.` : ' - and the calculation is using it.'} The past is not a promise.` }),
    Math.abs(hist.pct - Number(v.growthPct)) > 0.05 ? el('button', { class: 'btn btn-small', type: 'button', text: 'Use it', title: 'Use our own home’s growth for house prices', 'data-field': 'use-history', on: { click: () => { v.growthPct = Math.round(hist.pct * 10) / 10; d.mine.add('growthPct'); hub.render(); } } }) : null,
  ]) : null;
  if (r.missing) return [histLine, el('p', { class: 'panel muted', text: `Fill in ${r.missing.join(' and ')} to see the answer.` })];
  if (r.error) return [histLine, el('p', { class: 'panel', role: 'alert', text: r.error })];
  const who = r.ahead >= 0 ? 'Owning' : 'Renting';
  const yrs = (n) => `${n} year${n === 1 ? '' : 's'}`;
  const ownSide = r.keep ? 'keeping it' : 'buying';
  const lines = [
    r.keep
      ? `Selling now would bring about ${rand(r.saleNow.cash)}: ${rand(r.saleNow.price)} less ${rand(r.saleNow.costs)} selling costs${r.saleNow.owed ? `, the ${rand(r.saleNow.owed)} still owed` : ''}${r.saleNow.tax ? ` and ${rand(r.saleNow.tax)} tax` : ''}. ${Number(v.boughtFor) ? `The gain of about ${rand(r.saleNow.gain)} is ${r.saleNow.gain > 3000000 ? 'more than' : 'under'} the R3 million SARS does not tax on the home you live in.` : 'Add what you paid for it to check the tax on the gain.'} Renting, that money is invested.`
      : `Buying takes ${rand(r.ownerUp)} up front: the deposit, ${rand(r.duty)} transfer duty and about ${rand(r.fees)} in fees${Number(v.moveCost) ? ' and moving' : ''}. Renting, it stays invested.`,
    `Each month now, owning costs about ${rand(r.monthOwn)}${r.pmt ? ` (the bond is ${rand(r.pmt)})` : ''} and renting ${rand(r.monthRent)}. Whoever pays less invests ${Number(v.investShare) >= 100 ? 'the difference' : `${pct(Number(v.investShare), 0)} of the difference`}, growing ${pct(r.afterTaxPct, 1)} a year after tax.`,
    r.bondEnds ? `The bond ends in ${today.slice(0, 4) * 1 + Math.ceil(r.bondEnds)}; from then owning costs only the running costs, and the owner invests the rent they are not paying.` : null,
    `After ${yrs(r.year)}: ${ownSide}, the home would bring about ${rand(r.home)} once sold (after selling costs${r.tax ? `, ${rand(r.tax)} tax` : ''} and any bond)${r.invOwner > 1 ? `, plus ${rand(r.invOwner)} invested` : ''} - ${rand(r.owner)}. Renting: ${rand(r.renter)}.`,
    r.flips.length ? `Who is ahead changes in year ${r.flips.join(' and ')} - so how long you stay matters.` : null,
  ];
  const evens = [
    ['growthPct', 'house prices grow', -10, 30, '% a year'],
    ['rentRisePct', 'rent rises', -5, 30, '% a year'],
    ['investPct', 'investments grow (before tax)', -5, 40, '% a year'],
  ].map(([k, what, lo, hi]) => ({ k, what, at: evenAt(v, k, lo, hi), now: Number(v[k]) || 0 })).filter((x) => x.at != null);
  const out = [
    histLine,
    el('div', { class: 'stats' }, [
      stat(rand(Math.abs(r.ahead)), `${who.toLowerCase()} ahead after ${yrs(r.year)}`, 'r-ahead'),
      stat(r.breakeven == null ? 'Not in 30 years' : r.breakeven === 1 && r.series[0].ahead > 0 ? 'From the start' : yrs(r.breakeven), 'until owning is ahead', 'r-breakeven'),
      stat(`${rand(r.monthOwn)} · ${rand(r.monthRent)}`, 'a month now: owning · renting', 'r-monthly'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      ...lines.filter(Boolean).map((t) => el('p', { style: { margin: 0 }, text: t })),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'A projection from the figures above, not a prediction. The parts that matter most are below.' }),
    ]),
    evens.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it hangs on', style: { margin: 0 } }),
      el('ul', { style: { margin: 0 } }, evens.map((x) => el('li', { text: `They come out level if ${x.what} ${pct(x.at, 1)} a year - you have ${pct(x.now, 1)}.` }))),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'If someone swears renting (or owning) is better, these are the numbers they are assuming without saying.' }),
    ]) : null,
    forgotten(v, r),
  ];
  if (shows('advanced')) {
    const nudges = [
      { key: 'growthPct', what: 'house prices growing 2 points slower', to: (x) => (Number(x) || 0) - 2 },
      { key: 'rentRisePct', what: 'rent rising 2 points faster', to: (x) => (Number(x) || 0) + 2 },
      { key: 'investPct', what: 'investments growing 2 points faster', to: (x) => (Number(x) || 0) + 2 },
      { key: 'investShare', what: 'only half the difference really invested', to: () => 50 },
      { key: 'ratePct', what: 'the bond rate 1 point higher', to: (x) => (Number(x) || 0) + 1 },
      { key: 'maintYearly', what: 'maintenance costing twice as much', to: (x) => (Number(x) || 0) * 2 },
    ];
    out.push(el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Year by year', style: { margin: 0 } }),
      lineChart([
        { name: r.keep ? 'Keeping our home' : 'Buying', points: r.series.map((s) => [s.year * 12, s.owner]) },
        { name: r.keep ? 'Selling and renting' : 'Renting', points: r.series.map((s) => [s.year * 12, s.renter]), dashed: true },
      ], { label: 'What each side would have, year by year' }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['After', 'Owning', 'Renting', 'Ahead', 'Month: own · rent'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, r.series.filter((s) => [1, 2, 3, 5, 7, 10, 15, 20, 25, 30].includes(s.year)).map((s) => el('tr', {}, [
          el('td', { text: yrs(s.year) }), el('td', { class: 'num', text: rand(s.owner) }), el('td', { class: 'num', text: rand(s.renter) }),
          el('td', { class: `num ${s.ahead >= 0 ? 'fin-better' : 'fin-worse'}`, text: `${s.ahead >= 0 ? 'own' : 'rent'} ${rand(Math.abs(s.ahead))}` }),
          el('td', { class: 'num', text: `${rand(s.own)} · ${rand(s.rent)}` }),
        ]))),
      ])]),
      el('h3', { text: 'What moves the answer most', style: { margin: 0 } }),
      el('ul', { style: { margin: 0 } }, sensitivity(v, (x) => ownOrRent(x).ahead, nudges).filter((x) => Math.abs(x.change) >= 1)
        .map((x) => el('li', { text: `${x.what[0].toUpperCase()}${x.what.slice(1)}: owning ${x.change > 0 ? 'better' : 'worse'} off by ${rand(Math.abs(x.change))}.` }))),
    ]));
  }
  if (shows('learn')) {
    out.push(el('div', { class: 'panel stack fin-learn' }, [
      el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
      step('Same money, both sides', 'Each month the side that pays less invests the difference × the share really invested', `Now: owning ${rand(r.monthOwn)}, renting ${rand(r.monthRent)}`, 'Comparing rent with a bond alone is unfair both ways. Owning also costs rates, maintenance, duty and selling costs; renting leaves the deposit free to grow - but only if it is invested.'),
      step('Day one', r.keep ? 'Selling now: price − selling costs − bond owed − tax on the gain, invested' : 'The renter invests what the buyer pays up front: deposit + transfer duty + fees + moving − the rental deposit', r.keep ? rand(r.saleNow.cash) : rand(r.ownerUp)),
      step('Investments', 'Growth after tax = growth before tax × (1 − share lost to tax)', `${pct(Number(v.investPct) || 0, 1)} × (1 − ${pct(Number(v.investTaxPct) || 0, 0)}) = ${pct(r.afterTaxPct, 2)} a year`),
      step('The home', 'Value = today’s value × (1 + growth)^years + each upgrade’s added value, growing from when it is done', `After ${yrs(r.year)}: ${rand(r.value)}`, 'Upgrades are paid when done (the renter invests the same amount); repairs and maintenance are a cost and add nothing.'),
      step('Tax on selling your home', 'Taxed = gain − R3 000 000 − R50 000; tax = 40% of that × your tax rate', `Gain = sale price after costs − what it cost (purchase, duty, fees, improvements). ${CGT.source}.`),
      step('Who is ahead', 'Owner = home sold, less selling costs, bond and tax + investments. Renter = investments + deposit back', `${rand(r.owner)} against ${rand(r.renter)}`),
      el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
      el('ul', { class: 'small', style: { margin: 0 } }, [
        'Prices, rents and returns move steadily here; real ones jump about, and the order of good and bad years matters.',
        'Bond rates are held steady; a bond linked to prime changes when prime does.',
        'Security, being able to stay, making a place your own - and the freedom to move - are real but not money. Weigh them yourselves.',
      ].map((t) => el('li', { text: t }))),
    ]));
  }
  return out;
}

/** The things people forget - each either counted, with its value, or plainly not counted yet. */
function forgotten(v, r) {
  const n = (k) => Number(v[k]) || 0;
  const items = [
    [n('rentRisePct') > 0, `Rent rising every year (${pct(n('rentRisePct'), 1)}) while a bond instalment stays the same`],
    [r.bondEnds > 0, r.bondEnds > 0 ? `The bond ending in ${Math.ceil(r.bondEnds)} years - then owning costs only rates, insurance and upkeep` : 'No bond to pay'],
    [v.maintMode !== 'percent' && n('maintYearly') > 0, v.maintMode === 'percent' ? `Maintenance as ${pct(n('upkeepPct'), 1)} of the value - a rule of thumb; your own figure is better` : n('maintYearly') ? `Your own maintenance: ${rand(n('maintYearly'))} a year` : 'Maintenance - not counted yet'],
    [(v.upgrades ?? []).length > 0, (v.upgrades ?? []).length ? `Upgrades that add value: ${(v.upgrades ?? []).map((u) => u.name || 'an upgrade').join(', ')}` : 'Upgrades that add value - none planned'],
    [true, r.keep ? 'Transfer duty and fees - already paid on the home you own' : `Transfer duty ${rand(r.duty)} and fees ${rand(r.fees)}, paid however short the stay`],
    [n('sellPct') > 0, `Selling costs: ${pct(n('sellPct'), 1)} of the price when you sell`],
    [n('ratesTaxes') + n('levies') + n('insurance') > 0, n('ratesTaxes') + n('levies') + n('insurance') > 0 ? `Rates, levies and insurance: ${rand(n('ratesTaxes') + n('levies') + n('insurance'))} a month` : 'Rates, levies and building insurance - not counted yet'],
    [n('investTaxPct') > 0, `Tax on the investments: ${pct(n('investTaxPct'), 0)} of their growth`],
    [n('investShare') < 100, n('investShare') < 100 ? `How much of the difference really gets invested: ${pct(n('investShare'), 0)}` : 'How much of the difference really gets invested - assumed all of it, every month. Is that realistic?'],
    [true, `Tax on selling your home: none on the first R3 million of gain${r.keep && r.saleNow?.tax ? ` - here ${rand(r.saleNow.tax)}` : ''}`],
    [n('rentDeposit') > 0, n('rentDeposit') ? `The rental deposit (${rand(n('rentDeposit'))}) - cash needed, but it comes back` : 'The rental deposit - not counted yet'],
    [n('travelOwn') + n('travelRent') > 0, n('travelOwn') + n('travelRent') > 0 ? 'Getting to work from each place' : 'Getting to work from each place - not counted yet (Advanced)'],
    [n('moveCost') + n('rentMove') > 0, n('moveCost') + n('rentMove') > 0 ? 'Moving costs' : 'Moving costs - not counted yet (Advanced)'],
  ];
  return el('div', { class: 'panel stack', 'data-field': 'forgotten' }, [
    el('h2', { text: 'Did you think of…', style: { margin: 0 } }),
    el('ul', { class: 'checklist', style: { margin: 0, paddingLeft: 0, listStyle: 'none' } }, items.map(([ok, t]) => el('li', { class: ok ? null : 'muted', text: `${ok ? '✓' : '○'} ${t}` }))),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'And what is not money: being able to stay, making the place your own, the freedom to move. Weigh those yourselves.' }),
  ]);
}

/* ------------------------------------------------------------- compare */

function compareScreen(hub, param) {
  const ids = param.split(',').filter(Boolean);
  const res = hub.use(`compare:${param}`, async () => (await Promise.all(ids.map((id) => col(hub).get(id)))).filter(Boolean));
  if (res.loading) return loading();
  if (res.error) return failure(res.error);
  const kind = res.data[0]?.kind;
  const recs = res.data.filter((rec) => rec.kind === kind);
  const v = (rec) => ({ ...DEFAULTS, ...rec.values });
  let table;
  if (kind === 'home') {
    const items = recs.map((rec) => ({ title: rec.title, out: homeCost(v(rec)) })).filter((x) => x.out.total != null);
    const stays = new Set(items.map((x) => x.out.months));
    table = compareTable(items, [
      { label: 'Bought or rented', get: (c) => (c.buy ? 'Bought' : 'Rented') },
      { label: 'Living there for', get: (c) => months(c.months) },
      { key: 1, label: 'Cash needed to move in', get: (c) => c.upfront, lower: true },
      { label: 'A month now, all in', get: (c) => c.monthNow, lower: true },
      { key: 1, label: 'Travel to work', get: (c) => c.travel, lower: true },
      { label: 'Hours on the road a month', get: (c) => (c.hoursMonth ? `${Math.round(c.hoursMonth)} h` : '-') },
      { label: 'What comes back when leaving', get: (c) => c.back, lower: false },
      { key: 1, label: 'Total cost', get: (c) => c.total, lower: true, total: true },
      { label: 'Cost a month, all in', get: (c) => c.perMonth, lower: true },
    ], { unitNote: stays.size > 1 ? 'These are for different lengths of stay, so their totals are not like for like - compare the cost a month, or save them again with the same "live here for".' : null });
  } else if (kind === 'bond') {
    table = compareTable(recs.map((rec) => ({ title: rec.title, out: bond(v(rec)) })), [
      { label: 'Instalment a month', get: (b) => b.instalment, lower: true },
      { key: 1, label: 'Cash needed first', get: (b) => b.cashFirst, lower: true },
      { key: 1, label: 'Interest', get: (b) => b.interest, lower: true, total: true },
      { label: 'Paid in all', get: (b) => b.totalPaid, lower: true },
    ]);
  } else {
    table = compareTable(recs.map((rec) => ({ title: rec.title, out: ownOrRent(v(rec)) })).filter((x) => x.out.ahead != null), [
      { label: 'Compared after', get: (r) => `${r.year} years` },
      { label: 'Owning would have', get: (r) => r.owner, lower: false },
      { label: 'Renting would have', get: (r) => r.renter, lower: false },
      { key: 1, label: 'Owning ahead by', get: (r) => r.ahead, lower: false, total: true },
      { label: 'Owning gets ahead after', get: (r) => (r.breakeven ? `${r.breakeven} years` : 'not in 30 years') },
    ]);
  }
  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    el('h1', { id: 'cmp-title', text: 'Side by side', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: `Worked out with today’s maths from what was saved. Green is better than ${recs[0]?.title ?? 'the first'}, orange worse.` }),
    recs.length < 2 ? el('p', { class: 'panel', text: 'Tick two or more of the same kind to compare.' }) : table,
  ]);
}
