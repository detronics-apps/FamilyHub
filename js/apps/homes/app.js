// Homes (D-067): a bond on its own, the true cost of living in one home (bought or
// rented, with the trip to work), and renting against buying the same home. The
// three share their inputs, so a price typed once is there in all of them.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { homeCost, bond, rentOrBuy, transferDuty, feesEstimate, HOME_DEFAULTS, REFERENCE, sensitivity, monthlyRate } from '../finance/maths.js';
import { levelBar, shows, draft, loadDraft, inputsPanel, assumed, stat, sums, step, lineChart, savedPanel, compareTable, rand, pct, months } from '../finance/pod.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'hom' });
const DEFAULTS = { ...HOME_DEFAULTS, extra: null, income: null };
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
      ['rentbuy', 'Rent or buy', 'For the same home, which leaves us better off - and after how long?'],
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

const RB_FIELDS = pick(['price', 'deposit', 'ratePct', 'termYears', 'rent', 'stayYears', 'ratesTaxes', 'levies', 'insurance', 'growthPct', 'rentRisePct', 'otherRatePct', 'sellPct', 'upkeepPct', 'fees', 'rentDeposit', 'escalatePct'],
  { stayYears: { label: 'Compare after', hint: 'Who is ahead depends a great deal on how long you stay.' }, rent: { label: 'Rent for the same home, a month' }, rentDeposit: { level: 'advanced' } })
  .map((f) => ({ ...f, group: ['ratesTaxes', 'levies', 'insurance'].includes(f.key) ? 'own' : ['growthPct', 'rentRisePct', 'otherRatePct', 'sellPct', 'upkeepPct', 'fees', 'rentDeposit', 'escalatePct'].includes(f.key) ? 'more' : undefined }));
const rbHeadline = (v) => { const r = rentOrBuy(v); return r.ahead == null ? '' : `After ${r.year} years ${r.ahead >= 0 ? 'buying' : 'renting'} ahead by ${rand(Math.abs(r.ahead))}`; };

function rentBuyScreen(hub) {
  return page(hub, {
    id: 'rb-title', title: 'Rent or buy?', kind: 'rentbuy', headline: rbHeadline,
    intro: 'The same home, rented or bought, with the same money each month. Whoever spends less in a month saves the difference.',
    fields: RB_FIELDS, groups: { own: 'Owning costs (optional)', more: 'Growth, selling and fees' }, results: rbResults,
  });
}

function rbResults(d) {
  const v = d.values;
  const r = rentOrBuy(v);
  const stop = nothing(r);
  if (stop) return stop;
  const ahead = r.ahead >= 0 ? 'Buying' : 'Renting';
  const nudges = [
    { key: 'growthPct', what: 'house prices growing 2 points slower', to: (x) => (Number(x) || 0) - 2 },
    { key: 'growthPct', what: 'house prices growing 2 points faster', to: (x) => (Number(x) || 0) + 2 },
    { key: 'otherRatePct', what: 'savings earning 2 points more', to: (x) => (Number(x) || 0) + 2 },
    { key: 'rentRisePct', what: 'rent rising 2 points faster', to: (x) => (Number(x) || 0) + 2 },
    { key: 'ratePct', what: 'the interest rate 1 point higher', to: (x) => (Number(x) || 0) + 1 },
  ];
  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(Math.abs(r.ahead)), `${ahead.toLowerCase()} ahead after ${r.year} year${r.year === 1 ? '' : 's'}`, 'r-ahead'),
      stat(r.breakeven ? `${r.breakeven} year${r.breakeven === 1 ? '' : 's'}` : 'Not in 30 years', 'until buying gets ahead', 'r-breakeven'),
      stat(rand(r.upBuy), 'cash needed to buy', 'r-upfront'),
    ]),
    said('What it means', [
      `Owning costs ${rand(r.firstOwn)} a month at first (bond, rates, levies, insurance, upkeep), renting ${rand(r.firstRent)}. Whoever pays less in a month saves the difference - at first, ${r.firstOwn > r.firstRent ? 'the renter' : 'the owner'}; as rent rises, it can swap. The renter also saves the ${rand(r.upBuy)} the buyer pays up front.`,
      `After ${r.year} year${r.year === 1 ? '' : 's'}: the buyer’s home would bring about ${rand(r.home)} once sold and the bond settled${r.invBuyer > 1 ? `, plus ${rand(r.invBuyer)} saved` : ''} - ${rand(r.buyer)}. The renter would have ${rand(r.renter)}.`,
      r.breakeven ? `Buying gets ahead after about ${r.breakeven} year${r.breakeven === 1 ? '' : 's'} with these assumptions. Before that, the duty, fees and selling costs have not been earned back.` : 'With these assumptions buying does not get ahead within 30 years.',
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'This depends on house prices and savings growth, which nobody knows in advance - see what moves it below. It also assumes the difference really is saved each month.' }),
    ]),
    assumed(RB_FIELDS, d),
    list('What moves the answer most', sensitivity(v, (x) => rentOrBuy(x).ahead, nudges).filter((x) => Math.abs(x.change) >= 1)
      .map((x) => `${x.what[0].toUpperCase()}${x.what.slice(1)}: buying ${x.change > 0 ? 'better' : 'worse'} off by ${rand(Math.abs(x.change))}.`)),
  ];
  if (shows('advanced')) {
    out.push(el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Year by year', style: { margin: 0 } }),
      lineChart([
        { name: 'Buyer', points: r.series.map((s) => [s.year * 12, s.buyer]) },
        { name: 'Renter', points: r.series.map((s) => [s.year * 12, s.renter]), dashed: true },
      ], { label: 'What the buyer and the renter would each have, year by year' }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['After', 'Buyer', 'Renter', 'Difference'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, r.series.filter((s) => [1, 2, 3, 5, 7, 10, 15, 20, 25, 30].includes(s.year)).map((s) => el('tr', {}, [
          el('td', { text: `${s.year} year${s.year === 1 ? '' : 's'}` }), el('td', { class: 'num', text: rand(s.buyer) }), el('td', { class: 'num', text: rand(s.renter) }),
          el('td', { class: `num ${s.ahead >= 0 ? 'fin-better' : 'fin-worse'}`, text: `${s.ahead >= 0 ? 'buy' : 'rent'} ${rand(Math.abs(s.ahead))}` }),
        ]))),
      ])]),
    ]));
  }
  if (shows('learn')) {
    out.push(el('div', { class: 'panel stack fin-learn' }, [
      el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
      step('Same money, both ways', 'Each month: budget = the dearer of owning and renting; the other side saves the difference', `Month 1: owning ${rand(r.firstOwn)}, renting ${rand(r.firstRent)}`, 'Comparing rent with a bond instalment alone is unfair both ways: owning also costs rates, upkeep, duty and fees, and renting leaves the deposit free to grow.'),
      step('Day one', 'The renter saves what the buyer pays up front: deposit + transfer duty + fees − the rental deposit', `${rand(r.upBuy)} for the buyer`),
      step('Savings grow', 'Saved = saved × (1 + r) + this month’s difference', `r = ${pct(Number(v.otherRatePct) || 0)} a year ÷ 12`),
      step('Who is ahead', 'Buyer = value × (1 − selling costs) − bond still owed + savings; renter = savings + deposit back', `${rand(r.buyer)} against ${rand(r.renter)}`),
      ...leavesOut([
        'House prices, rent and savings are assumed to grow steadily. They do not, and the order of good and bad years matters.',
        'Tax on savings growth is not counted; it would favour buying a little.',
        'It assumes the difference really is saved every month. If it is spent instead, buying usually comes out further ahead.',
        'Security of tenure, freedom to move, and making a place your own are real, but not money - weigh them yourselves.',
      ]),
    ]));
  }
  return out;
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
    table = compareTable(recs.map((rec) => ({ title: rec.title, out: rentOrBuy(v(rec)) })), [
      { label: 'Compared after', get: (r) => `${r.year} years` },
      { label: 'Buyer would have', get: (r) => r.buyer, lower: false },
      { label: 'Renter would have', get: (r) => r.renter, lower: false },
      { key: 1, label: 'Buying ahead by', get: (r) => r.ahead, lower: false, total: true },
      { label: 'Buying gets ahead after', get: (r) => (r.breakeven ? `${r.breakeven} years` : 'not in 30 years') },
    ]);
  }
  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    el('h1', { id: 'cmp-title', text: 'Side by side', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: `Worked out with today’s maths from what was saved. Green is better than ${recs[0]?.title ?? 'the first'}, orange worse.` }),
    recs.length < 2 ? el('p', { class: 'panel', text: 'Tick two or more of the same kind to compare.' }) : table,
  ]);
}
