// Cars: the true cost of owning a car (D-066) - not just the instalment. Keeps
// apart what goes to the bank, what running it costs, what the sale brings in and
// what is still owed then. Save each car or finance option by name and compare.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { carCost, CAR_DEFAULTS, REFERENCE, sensitivity, CAR_NUDGES, monthlyRate } from '../finance/maths.js';
import { levelBar, shows, draft, loadDraft, inputsPanel, assumed, stat, sums, step, lineChart, savedPanel, compareTable, rand, pct, months } from '../finance/pod.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'car' });
const KIND = 'car';

const TERMS = [36, 48, 60, 72, 84].map((m) => ({ value: m, label: `${m / 12} years` }));
const FIELDS = [
  { key: 'price', label: 'Price of the car', type: 'money', level: 'simple' },
  { key: 'deposit', label: 'Deposit', type: 'money', level: 'simple', source: { kind: 'assumption' } },
  { key: 'ratePct', label: 'Interest rate', type: 'percent', level: 'simple', source: { ref: REFERENCE.prime, note: '+ 1.5 points (illustrative)' }, hint: 'The rate on your quote. Car loans are usually a little above prime, and move when prime moves.' },
  { key: 'termMonths', label: 'Pay it off over', type: 'choice', level: 'simple', choices: TERMS },
  { key: 'keepYears', label: 'Keep it for', type: 'years', level: 'simple', source: { kind: 'assumption' }, hint: 'When you expect to sell it. It can be before the loan is paid off.' },
  { key: 'insurance', label: 'Insurance a month', type: 'money', level: 'simple', optional: true, group: 'running' },
  { key: 'fuel', label: 'Fuel or charging a month', type: 'money', level: 'simple', optional: true, group: 'running' },
  { key: 'upkeep', label: 'Services, tyres and repairs a month', type: 'money', level: 'simple', optional: true, group: 'running', hint: 'An average: a R6 000 service once a year is R500 a month.' },
  { key: 'licenceYearly', label: 'Licence and other yearly costs', type: 'money', level: 'advanced', optional: true, group: 'running' },
  { key: 'escalatePct', label: 'Running costs rise by', type: 'percent', level: 'advanced', source: { ref: REFERENCE.cpi }, group: 'running' },
  { key: 'kmYearly', label: 'Distance driven', type: 'km', level: 'advanced', optional: true, group: 'running', hint: 'Only to show the cost per kilometre.' },
  { key: 'balloonPct', label: 'Balloon (of the price)', type: 'percent', level: 'advanced', source: { kind: 'assumption' }, hint: 'Part of the price left to pay in one go at the end. Lower instalments, more interest.', group: 'loan' },
  { key: 'initiationFee', label: 'Initiation fee', type: 'money', level: 'advanced', source: { kind: 'illustrative' }, hint: 'A once-off fee for opening the loan.', group: 'loan' },
  { key: 'feeFinanced', label: 'Initiation fee added to the loan', type: 'check', level: 'advanced', source: { kind: 'assumption' }, group: 'loan' },
  { key: 'serviceFee', label: 'Monthly service fee', type: 'money', level: 'advanced', source: { kind: 'illustrative' }, hint: 'The bank’s admin fee, paid with every instalment.', group: 'loan' },
  { key: 'resaleMode', label: 'Value when sold', type: 'choice', level: 'advanced', redraw: true, choices: [{ value: 'depreciation', label: 'Drops each year' }, { value: 'amount', label: 'Sale price' }], group: 'sale' },
  { key: 'depreciationPct', label: 'Drops in value by', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'New cars often lose 15 to 20% a year at first. Look up what similar used cars sell for.', group: 'sale', when: (v) => v.resaleMode !== 'amount' },
  { key: 'resaleAmount', label: 'Expected sale price', type: 'money', level: 'advanced', optional: true, group: 'sale', when: (v) => v.resaleMode === 'amount' },
];
const GROUPS = { running: 'Running costs (optional)', loan: 'Loan details', sale: 'Selling it' };

export function render(hub, route) {
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  return mainScreen(hub);
}

function mainScreen(hub) {
  const d = draft(KIND, CAR_DEFAULTS);
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...results(d));
  const changed = (key) => (FIELDS.find((f) => f.key === key)?.redraw ? hub.render() : refresh());
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'cars-title' }, [
    el('h1', { id: 'cars-title', text: 'What will this car really cost?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Not just the instalment: interest, fees, running costs, and what it is worth - and still owed - when you sell it.' }),
    levelBar(() => hub.render()),
    inputsPanel(FIELDS, d, GROUPS, changed),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: KIND, d, compareScreen: 'compare',
      summary: () => { const c = carCost(d.values); return c.total == null ? {} : { headline: `${rand(c.total)} over ${months(c.months)} · ${rand(c.instalment)} a month`, total: c.total, instalment: c.instalment }; },
      onOpen: (rec) => { loadDraft(KIND, CAR_DEFAULTS, rec); hub.render(); },
    }),
  ]);
}

function results(d) {
  const v = d.values;
  const c = carCost(v);
  if (c.missing) return [el('p', { class: 'panel muted', text: `Fill in ${c.missing.join(' and ')} to see the answer.` })];
  if (c.error) return [el('p', { class: 'panel', role: 'alert', text: c.error })];
  const kept = months(c.months);
  const noRunning = c.runningFirstMonth === 0;
  const out = [
    el('div', { class: 'stats' }, [
      c.financed ? stat(rand(c.instalment), 'instalment a month', 'r-instalment') : stat('Cash', 'no loan', 'r-instalment'),
      stat(rand(c.total), `total cost of owning it for ${kept}`, 'r-total'),
      stat(rand(c.perMonth), noRunning ? 'a month, before running costs' : 'a month, all in', 'r-month'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      ...meaning(c, v).map((t) => el('p', { style: { margin: 0 }, text: t })),
      sums([
        { label: 'Paid up front', value: c.upfront, note: 'Deposit, and the initiation fee if it is not in the loan' },
        { label: 'Paid to the bank', value: c.toBank, note: c.financed ? `${Math.min(c.months, c.termMonths)} instalments${c.balloon && c.months >= c.termMonths ? ' and the balloon' : ''}` : null },
        { label: 'Running costs', value: noRunning ? 'not entered' : c.running },
        { label: 'Less the sale price', value: -c.resale, note: `What it fetches after ${kept}` },
        { label: 'Still owed to the bank then', value: c.owed, note: c.owed > 0 ? 'Settled from the sale' : null },
        { label: 'Total cost of owning it', value: c.total, total: true },
      ]),
      el('h3', { text: 'Where the cost goes', style: { margin: 0 } }),
      sums([
        { label: 'Drop in value', value: c.depreciation, note: `${rand(c.price)} new, about ${rand(c.resale)} when sold` },
        { label: 'Interest', value: c.interest },
        { label: 'Bank fees', value: c.fees },
        { label: 'Running costs', value: noRunning ? 'not entered' : c.running },
        { label: 'Total', value: c.total, total: true, note: 'The same total, counted the other way - repaying the loan is paying for the car, not a cost on top of it.' },
      ]),
    ]),
    assumed(FIELDS, d),
    levers(c, v),
  ];
  if (shows('advanced')) out.push(advanced(c, v));
  if (shows('learn')) out.push(learn(c, v));
  return out.filter(Boolean);
}

function meaning(c, v) {
  const lines = [];
  if (c.financed) lines.push(`You borrow ${rand(c.loan)} and pay ${rand(c.instalment)} a month for ${months(c.termMonths)}${c.balloon ? `, then ${rand(c.balloon)} as the balloon` : ''}. Of everything paid to the bank, ${rand(c.interest)} is interest and ${rand(c.fees)} fees.`);
  if (c.owed > 0.5) {
    lines.push(`Selling after ${months(c.months)}, you would still owe the bank ${rand(c.owed)}. At about ${rand(c.resale)} for the car, ${c.atSale >= 0 ? `you keep ${rand(c.atSale)} after settling the loan` : `you would need to find ${rand(-c.atSale)} to settle the loan`}.`);
  } else lines.push(`Sold after ${months(c.months)} for about ${rand(c.resale)}, with nothing left owing.`);
  if (c.resale > c.price) lines.push(`Selling for more than you paid is not a profit here: interest, fees and running costs still make owning it cost ${rand(c.total)}.`);
  if (c.runningFirstMonth === 0) lines.push('Running costs are not counted yet. Add insurance, fuel and upkeep for the full picture.');
  return lines;
}

/** What would change the answer, worked out rather than guessed. */
function levers(c, v) {
  const tries = [];
  if (c.financed && v.termMonths > 36) {
    const t = carCost({ ...v, termMonths: v.termMonths - 12 });
    tries.push(`Paying it off a year sooner: ${rand(t.instalment)} a month (${rand(t.instalment - c.instalment)} more), and ${rand(c.interest - t.interest)} less interest over the time you keep it.`);
  }
  if (c.financed) {
    const more = Math.round(c.price * 0.1);
    const t = carCost({ ...v, deposit: (Number(v.deposit) || 0) + more });
    tries.push(`${rand(more)} more deposit: ${rand(c.instalment - t.instalment)} less a month and ${rand(c.interest - t.interest)} less interest.`);
  }
  const longer = carCost({ ...v, keepYears: (Number(v.keepYears) || 0) + 2 });
  if (!longer.error) tries.push(`Keeping it 2 years longer: ${rand(longer.perMonth)} a month all in, against ${rand(c.perMonth)} now.`);
  return tries.length ? el('div', { class: 'panel stack' }, [
    el('h2', { text: 'What would change it', style: { margin: 0 } }),
    el('ul', { style: { margin: 0 } }, tries.map((t) => el('li', { text: t }))),
  ]) : null;
}

function advanced(c, v) {
  const sens = sensitivity(v, (x) => carCost(x).total, CAR_NUDGES).filter((x) => Math.abs(x.change) >= 1);
  const range = [-5, 0, 5].map((dp) => carCost({ ...v, resaleMode: 'depreciation', depreciationPct: Math.max(0, (v.resaleMode === 'amount' ? impliedDrop(c) : Number(v.depreciationPct) || 0) + dp) }));
  const rateUp = c.financed ? carCost({ ...v, ratePct: (Number(v.ratePct) || 0) + 1 }) : null;
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Over time', style: { margin: 0 } }),
    lineChart([
      { name: 'Money paid out so far', points: c.timeline.map((t) => [t.month, t.cashOut]) },
      { name: 'Cost if sold that month', points: c.timeline.map((t) => [t.month, t.cost]), dashed: true },
    ], { label: 'Money paid out, and the cost of owning it if sold that month' }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'The gap between the lines is what selling would bring back after settling the loan.' }),
    el('h3', { text: 'What moves the answer most', style: { margin: 0 } }),
    sens.length ? el('ul', { style: { margin: 0 } }, sens.map((x) => el('li', { text: `${x.what[0].toUpperCase()}${x.what.slice(1)}: ${x.change > 0 ? '+' : '−'}${rand(Math.abs(x.change))}` }))) : null,
    rateUp ? el('p', { style: { margin: 0 }, text: `If the rate rises 1 point (prime-linked loans move with prime), the instalment becomes ${rand(rateUp.instalment)}.` }) : null,
    el('h3', { text: 'If the car holds its value better or worse', style: { margin: 0 } }),
    sums([
      { label: 'Holds its value better', value: range[0].total, note: `About ${rand(range[0].resale)} when sold` },
      { label: 'As assumed', value: range[1].total, note: `About ${rand(range[1].resale)} when sold` },
      { label: 'Loses value faster', value: range[2].total, note: `About ${rand(range[2].resale)} when sold` },
    ]),
    c.perKm ? el('p', { style: { margin: 0 }, text: `That is about ${rand(c.perKm * 100)} per 100 km driven.` }) : null,
  ]);
}

/** The yearly drop a chosen sale price implies, so better and worse can be shown around it. */
const impliedDrop = (c) => (1 - (c.resale / c.price) ** (12 / c.months)) * 100;

function learn(c, v) {
  const r = monthlyRate(v.ratePct);
  const n = c.termMonths;
  const k = Math.min(c.months, n);
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    c.financed ? step('1. The instalment',
      'P = (L × (1+r)^n − B) × r ÷ ((1+r)^n − 1)',
      `P = (${rand(c.loan)} × (1+${(r * 100).toFixed(4)}%)^${n} − ${rand(c.balloon)}) × ${(r * 100).toFixed(4)}% ÷ ((1+${(r * 100).toFixed(4)}%)^${n} − 1) = ${rand(c.repayment)}, plus the ${rand(c.serviceFee)} service fee = ${rand(c.instalment)}`,
      `L is the amount borrowed, r the yearly rate ÷ 12, n the number of months, B the balloon. Each payment covers that month’s interest on what is still owed, and the rest pays the loan down - so early payments are mostly interest. Here r = ${pct(Number(v.ratePct))} ÷ 12.`) : null,
    c.financed ? step('2. What is still owed when you sell',
      'Owed after k months = L × (1+r)^k − P × ((1+r)^k − 1) ÷ r',
      `k = ${k} months: ${rand(c.owed)}${c.months >= n ? ' (the loan, and any balloon, is paid off by then)' : ''}`,
      'Selling before the loan ends does not make the remaining balance go away: it is paid from the sale price first.') : null,
    c.financed ? step('3. Interest',
      'Interest = everything paid to the lender (without fees) − how much the loan went down',
      `${rand(c.repayment * k + (c.months >= n ? c.balloon : 0))} − (${rand(c.loan)} − ${rand(c.owed)}) = ${rand(c.interest)}`) : null,
    step('4. The total cost of owning it',
      'Cost = up front + paid to the bank + running costs − (sale price − still owed)',
      `${rand(c.upfront)} + ${rand(c.toBank)} + ${rand(c.running)} − (${rand(c.resale)} − ${rand(c.owed)}) = ${rand(c.total)}`,
      'Counted the other way it is the drop in value + interest + fees + running costs - the same number. The loan’s capital is not added on top of the price: repaying it is paying for the car.'),
    step('5. Value when sold',
      v.resaleMode === 'amount' ? 'The sale price you entered' : 'Value = price × (1 − drop)^years',
      v.resaleMode === 'amount' ? rand(c.resale) : `${rand(c.price)} × (1 − ${pct(Number(v.depreciationPct) || 0)})^${(c.months / 12).toFixed(2)} = ${rand(c.resale)}`,
      'Real cars do not lose value smoothly - the first year usually costs most - and the sale price is the most uncertain number here. See "If the car holds its value better or worse".'),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'The rate is held steady. Most car loans are linked to prime and change when it does.',
      'Money paid later is counted the same as money paid now (no discounting). What the deposit could have earned elsewhere is not counted.',
      'Running costs rise once a year by the rate you set; fuel prices can jump more than that.',
      'Fees follow the figures entered. The initiation and service fees shown are illustrative - use the ones on your quote.',
      'Tax, extended warranties, add-on insurance products, and the time value of a car being off the road are not included.',
    ].map((t) => el('li', { text: t }))),
  ]);
}

/* ------------------------------------------------------------- compare */

function compareScreen(hub, param) {
  const ids = param.split(',').filter(Boolean);
  const r = hub.use(`compare:${param}`, async () => (await Promise.all(ids.map((id) => col(hub).get(id)))).filter(Boolean));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const items = r.data.map((rec) => ({ title: rec.title, out: carCost({ ...CAR_DEFAULTS, ...rec.values }) })).filter((x) => x.out.total != null);
  const lengths = new Set(items.map((x) => x.out.months));
  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    el('h1', { id: 'cmp-title', text: 'Side by side', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: `Each saved car or finance option, worked out with today’s maths. Green is cheaper than ${items[0]?.title ?? 'the first'}, orange dearer.` }),
    items.length < 2 ? el('p', { class: 'panel', text: 'Two or more saved options are needed to compare.' }) : compareTable(items, [
      { label: 'Instalment a month', get: (c) => c.instalment, lower: true },
      { label: 'Kept for', get: (c) => months(c.months) },
      { key: 1, label: 'Interest', get: (c) => c.interest, lower: true },
      { key: 1, label: 'Bank fees', get: (c) => c.fees, lower: true },
      { label: 'Paid to the bank', get: (c) => c.toBank, lower: true },
      { key: 1, label: 'Running costs', get: (c) => c.running, lower: true },
      { label: 'Sale price when sold', get: (c) => c.resale, lower: false },
      { label: 'Still owed then', get: (c) => c.owed, lower: true },
      { key: 1, label: 'Total cost of owning it', get: (c) => c.total, lower: true, total: true },
      { label: 'Cost a month, all in', get: (c) => c.perMonth, lower: true },
    ], { unitNote: lengths.size > 1 ? 'These are kept for different lengths of time, so their totals are not like for like - compare the cost a month, or save them again with the same "keep it for".' : null }),
  ]);
}
