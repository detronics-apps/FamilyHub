// Cars: the true cost of owning a car (D-066) - not just the instalment. Keeps
// apart what goes to the bank, what running it costs, what the sale brings in and
// what is still owed then. Save each car or finance option by name and compare.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { carCost, CAR_SCENARIOS, CAR_DEFAULTS, REFERENCE, sensitivity, CAR_NUDGES, monthlyRate, ENERGY, POWER, typicalLitres, typicalKwh, fuelPriceFor } from '../finance/maths.js';
import { CAR_HELP } from '../finance/help.js';
import { levelBar, shows, draft, loadDraft, linesPanel, inputsPanel, assumed, stat, sums, step, lineChart, chartPanel, RULE, outOf, crossing, whenLabel, savedPanel, compareTable, rand, pct, months } from '../finance/pod.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'car' });
const KIND = 'car';

const TERMS = [36, 48, 60, 72, 84].map((m) => ({ value: m, label: `${m / 12} years` }));
const FIELDS = [
  { key: 'price', label: 'Price of the car', type: 'money', level: 'simple' },
  { key: 'deposit', label: 'Deposit', type: 'money', level: 'simple', source: { kind: 'assumption' } },
  { key: 'ratePct', label: 'Interest rate', type: 'percent', level: 'simple', source: { ref: REFERENCE.prime, note: '+ 1.5 points (illustrative)' }, hint: 'The rate on your quote. Car loans are usually a little above prime, and move when prime moves.' },
  { key: 'termMonths', label: 'Pay it off over', type: 'choice', level: 'simple', choices: TERMS },
  { key: 'keepYears', label: 'Keep it for', type: 'years', level: 'simple', source: { kind: 'assumption' }, hint: 'When you expect to sell it. It can be before the loan is paid off.' },
  // Fuel and charging (D-076): worked out from distance and consumption.
  { key: 'power', label: 'It runs on', type: 'choice', level: 'simple', redraw: true, group: 'energy', choices: Object.entries(POWER).map(([value, label]) => ({ value, label })) },
  { key: 'kmYearly', label: 'Distance driven', type: 'km', level: 'simple', optional: true, group: 'energy', hint: 'From the odometer or your service book. 15 000 to 20 000 km a year is common.' },
  { key: 'region', label: 'Fuel bought', type: 'choice', level: 'simple', group: 'energy', choices: [{ value: 'inland', label: 'Inland' }, { value: 'coastal', label: 'At the coast' }], when: (v) => v.power !== 'electric' },
  { key: 'lPer100', label: 'Fuel use', type: 'number', unitText: 'litres per 100 km', level: 'simple', group: 'energy', estimate: (v) => typicalLitres(v.power), when: (v) => v.power !== 'electric', hint: 'From the car’s specifications, or your own (fill up, note the km, divide). Left empty: a typical figure.' },
  { key: 'kwhPer100', label: 'Electricity use', type: 'number', unitText: 'kWh per 100 km', level: 'simple', group: 'energy', estimate: (v) => typicalKwh(v.power), when: (v) => v.power === 'electric' || v.power === 'plugin', hint: 'From the specifications. Left empty: a typical figure. Highway driving uses more.' },
  { key: 'electricShare', label: 'Of the kilometres, on electricity', type: 'percent', unitText: '%', level: 'simple', group: 'energy', source: { kind: 'assumption' }, when: (v) => v.power === 'plugin', hint: 'Short daily trips, charged every night: most of them. Long trips: few.' },
  { key: 'homeShare', label: 'Of the charging, done at home', type: 'percent', unitText: '%', level: 'simple', group: 'energy', source: { kind: 'assumption' }, when: (v) => v.power === 'electric' || v.power === 'plugin', hint: 'Home charging costs about half of public fast charging.' },
  { key: 'chargerInstall', label: 'Home charger, installed', type: 'money', level: 'simple', optional: true, group: 'energy', when: (v) => v.power === 'electric' || v.power === 'plugin', hint: 'Once off. Get a quote - it depends on the distance from the board and the charger.' },
  { key: 'fuelPrice', label: 'Fuel price', type: 'money', unitText: 'a litre', level: 'advanced', group: 'energy', source: { kind: 'reference', text: ENERGY.source }, estimate: (v) => fuelPriceFor(v.power, v.region), when: (v) => v.power !== 'electric', hint: 'Petrol 95, or diesel wholesale (the pump is a little more). New prices on the first Wednesday of each month.' },
  { key: 'homeTariff', label: 'Home electricity', type: 'money', unitText: 'a kWh', level: 'advanced', group: 'energy', source: { kind: 'reference', text: ENERGY.home.source }, when: (v) => v.power === 'electric' || v.power === 'plugin', hint: 'On your municipal or Eskom bill. Prepaid and time-of-use tariffs differ.' },
  { key: 'publicTariff', label: 'Public charging', type: 'money', unitText: 'a kWh', level: 'advanced', group: 'energy', source: { kind: 'reference', text: ENERGY.public.source }, when: (v) => v.power === 'electric' || v.power === 'plugin' },
  { key: 'chargeLoss', label: 'Lost while charging', type: 'percent', unitText: '%', level: 'advanced', group: 'energy', source: { kind: 'illustrative' }, when: (v) => v.power === 'electric' || v.power === 'plugin', hint: 'Power that never reaches the battery - often 10 to 15%.' },
  { key: 'fuelRisePct', label: 'Fuel prices rise by', type: 'percent', level: 'advanced', group: 'energy', source: { kind: 'assumption' }, when: (v) => v.power !== 'electric', hint: 'Fuel jumps about with oil and the rand; it rose sharply in 2026.' },
  { key: 'elecRisePct', label: 'Electricity rises by', type: 'percent', level: 'advanced', group: 'energy', source: { kind: 'reference', text: ENERGY.elecRise.source }, when: (v) => v.power === 'electric' || v.power === 'plugin' },
  { key: 'fuel', label: 'Or your own figure for fuel and charging, a month', type: 'money', level: 'advanced', optional: true, group: 'energy', hint: 'Replaces the worked-out figure above.' },
  // Insurance, service and upkeep.
  { key: 'insurance', label: 'Insurance a month', type: 'money', level: 'simple', optional: true, group: 'running', hint: 'Get a quote for the exact car. Electric cars often cost more to insure.' },
  { key: 'serviceYearly', label: 'Service, a year', type: 'money', level: 'simple', optional: true, group: 'running', hint: 'Check the service plan. Electric cars need far less servicing - no oil, fewer parts.' },
  { key: 'oilYearly', label: 'Oil between services, a year', type: 'money', level: 'simple', optional: true, group: 'running', when: (v) => v.power !== 'electric' },
  { key: 'tyresYearly', label: 'Tyres, a year on average', type: 'money', level: 'simple', optional: true, group: 'running', hint: 'A set every 40 000 to 60 000 km, spread over the years. Heavier electric cars wear them sooner.' },
  { key: 'licenceYearly', label: 'Licence and other yearly costs', type: 'money', level: 'simple', optional: true, group: 'running' },
  { key: 'upkeep', label: 'Other repairs, a month on average', type: 'money', level: 'advanced', optional: true, group: 'running', hint: 'Brakes, batteries, wipers, the unexpected. More once the warranty ends.' },
  { key: 'escalatePct', label: 'Insurance, service and repairs rise by', type: 'percent', level: 'advanced', source: { ref: REFERENCE.cpi }, group: 'running' },
  { key: 'balloonPct', label: 'Balloon (of the price)', type: 'percent', level: 'advanced', source: { kind: 'assumption' }, hint: 'Part of the price left to pay in one go at the end. Lower instalments, more interest.', group: 'loan' },
  { key: 'initiationFee', label: 'Initiation fee', type: 'money', level: 'advanced', source: { kind: 'illustrative' }, hint: 'A once-off fee for opening the loan.', group: 'loan' },
  { key: 'feeFinanced', label: 'Initiation fee added to the loan', type: 'check', level: 'advanced', source: { kind: 'assumption' }, group: 'loan' },
  { key: 'serviceFee', label: 'Monthly service fee', type: 'money', level: 'advanced', source: { kind: 'illustrative' }, hint: 'The bank’s admin fee, paid with every instalment.', group: 'loan' },
  { key: 'resaleMode', label: 'Value when sold', type: 'choice', level: 'advanced', redraw: true, choices: [{ value: 'depreciation', label: 'Drops each year' }, { value: 'amount', label: 'Sale price' }], group: 'sale' },
  { key: 'depreciationPct', label: 'Drops in value by', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, hint: 'New cars often lose 15 to 20% a year at first. Look up what similar used cars sell for.', group: 'sale', when: (v) => v.resaleMode !== 'amount' },
  { key: 'resaleAmount', label: 'Expected sale price', type: 'money', level: 'advanced', optional: true, group: 'sale', when: (v) => v.resaleMode === 'amount' },
];
for (const f of FIELDS) f.info ??= CAR_HELP[f.key];
const GROUPS = {
  energy: { title: 'Fuel or charging', info: CAR_HELP.energy, tick: 'energy' },
  running: { title: 'Insurance, service and upkeep', info: CAR_HELP.running, tick: 'running' },
  loan: { title: 'Loan details', info: CAR_HELP.loan },
  sale: 'Selling it',
};

export function render(hub, route) {
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  return mainScreen(hub);
}

function mainScreen(hub) {
  const d = draft(KIND, CAR_DEFAULTS);
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const today = hub.today();
  const refresh = () => answer.replaceChildren(...results(d, today));
  const changed = (key) => (key === 'on' || FIELDS.find((f) => f.key === key)?.redraw ? hub.render() : refresh());
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'cars-title' }, [
    el('h1', { id: 'cars-title', text: 'What will this car really cost?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Not just the instalment: interest, fees, running costs, and what it is worth - and still owed - when you sell it.' }),
    levelBar(() => hub.render()),
    inputsPanel(FIELDS, d, GROUPS, changed),
    linesPanel(d, refresh, 'scenarios', CAR_SCENARIOS, 'What if…', CAR_HELP.scenarios, true),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: KIND, d, compareScreen: 'compare',
      summary: () => { const c = carCost(d.values, today); return c.total == null ? {} : { headline: `${rand(c.total)} over ${months(c.months)} · ${rand(c.instalment)} a month`, total: c.total, instalment: c.instalment }; },
      onOpen: (rec) => { loadDraft(KIND, CAR_DEFAULTS, rec); hub.render(); },
    }),
  ]);
}

function results(d, today) {
  const v = d.values;
  const c = carCost(v, today);
  // The same car without the ticked what-ifs, for the with-and-without lines.
  const c0 = c.scenarios ? carCost({ ...v, scenarios: [] }, today) : null;
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
        { label: 'Paid up front', value: -c.upfront, note: `Deposit${c.charger ? ', home charger' : ''}, and the initiation fee if it is not in the loan` },
        { label: 'Paid to the bank', value: -c.toBank, note: c.financed ? `${Math.min(c.months, c.termMonths)} instalments${c.balloon && c.months >= c.termMonths ? ' and the balloon' : ''}` : null },
        { label: 'Running costs', value: noRunning ? 'not entered' : -c.running },
        { label: 'The sale price', value: c.resale, note: `What it fetches after ${kept}` },
        { label: 'Still owed to the bank then', value: -c.owed, note: c.owed > 0 ? 'Settled from the sale' : null },
        { label: `What owning it costs you over ${kept}`, value: -c.total, total: true },
      ]),
      el('h3', { text: 'Where the cost goes', style: { margin: 0 } }),
      sums([
        { label: 'Drop in value', value: -c.depreciation, note: `${rand(c.price)} new, about ${rand(c.resale)} when sold` },
        { label: 'Interest', value: -c.interest },
        { label: 'Bank fees', value: -c.fees },
        c.charger ? { label: 'Home charger', value: -c.charger } : null,
        { label: 'Running costs', value: noRunning ? 'not entered' : -c.running },
        { label: 'Total', value: -c.total, total: true, note: 'The same total, counted the other way - repaying the loan is paying for the car, not a cost on top of it.' },
      ]),
    ]),
    c0 ? el('div', { class: 'panel stack' }, [el('h2', { text: 'With your what-ifs', style: { margin: 0 } }), el('p', { style: { margin: 0 }, text: `Loan paid off after ${months(c.loanMonths)} instead of ${months(c0.loanMonths)}${c.loanMonths < c0.loanMonths ? ` - ${months(c0.loanMonths - c.loanMonths)} sooner` : ''}, with ${rand(Math.abs(c0.interest - c.interest))} ${c.interest <= c0.interest ? 'less' : 'more'} interest. Owning it costs ${rand(Math.abs(c0.total - c.total))} ${c.total <= c0.total ? 'less' : 'more'} over ${months(c.months)}${c.taken ? `, counting the ${rand(c.taken)} taken back out` : ''}.` }), c.taken ? el('p', { class: 'small muted', style: { margin: 0 }, text: 'Most car finance cannot be drawn back out once paid - check with your bank before counting on it.' }) : null]) : null,
    carStory(c, c0),
    assumed(FIELDS, d),
    levers(c, v),
    carForgotten(v, c),
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
  const en = c.energy;
  if (en.own) lines.push(`Fuel and charging: your own figure, ${rand(en.fuelMonth)} a month.`);
  else if (en.km) {
    const parts = [];
    if (en.litres) parts.push(`${Math.round(en.litres).toLocaleString('en-ZA')} litres a year at ${rand(en.price)} - ${rand(en.fuelMonth)} a month`);
    if (en.kwh) parts.push(`${Math.round(en.kwh).toLocaleString('en-ZA')} kWh a year at about ${rand(en.tariff)} a kWh (home and public charging, with what is lost charging) - ${rand(en.elecMonth)} a month`);
    lines.push(`${POWER[en.power]}, ${Math.round(en.km).toLocaleString('en-ZA')} km a year: ${parts.join('; and ')}. That is ${rand(en.perKm * 100)} per 100 km.`);
  } else lines.push('Fuel or charging is not counted yet - put in the distance driven a year.');
  if (c.runningFirstMonth === 0) lines.push('Running costs are not counted yet. Add insurance, the service and tyres for the full picture.');
  return lines;
}

/** What the car is worth against what is still owed on it - and when that turns. */
function carStory(c, c0 = null) {
  if (!c.financed) return null;
  const value = c.timeline.map((t) => [t.month, t.value]); const owed = c.timeline.map((t) => [t.month, t.owed]);
  const turn = crossing(value, owed);
  const end = c.loanMonths <= c.months ? { x: c.loanMonths, label: 'Loan paid off' } : { x: c.months, label: 'Sold' };
  return chartPanel('Money in and out',
    lineChart([
      { name: 'What it is worth', points: value },
      { name: c0 ? 'Still owed, with your what-ifs' : 'Still owed on the loan', points: outOf(owed) },
      ...(c0 ? [{ name: 'Still owed, without', points: outOf(c0.timeline.map((t) => [t.month, t.owed])), dashed: true }] : []),
      { name: 'Paid out so far', points: outOf(c.timeline.map((t) => [t.month, t.cashOut])), dashed: !c0 },
    ], { label: 'What the car is worth, what is still owed, and what has been paid out so far',
      marks: [turn != null && owed[1]?.[1] > value[1]?.[1] ? { x: turn, label: `Worth more than owed from ${whenLabel(turn)}` } : null, end],
      story: `${RULE} The car is worth less each year; until it is worth more than is owed, selling it would not settle the loan. Paid out is the deposit, every instalment, and running it.` }),
    lineChart([{ name: c0 ? 'Paid out that month, with your what-ifs' : 'Paid out that month', points: outOf(c.timeline.filter((t) => t.month > 0).map((t) => [t.month, t.out])) },
      ...(c0 ? [{ name: 'Without them', points: outOf(c0.timeline.filter((t) => t.month > 0).map((t) => [t.month, t.out])), dashed: true }] : [])],
      { label: 'What the car takes out of your pocket each month', marks: [end], story: 'The instalment and running costs each month. After the loan, only running it.' }));
}

/** What people forget about running a car - different for petrol, hybrids and electric cars. */
function carForgotten(v, c) {
  const n = (k) => Number(v[k]) || 0;
  const ev = v.power === 'electric'; const plug = v.power === 'plugin'; const fuel = !ev;
  const items = [
    [n('kmYearly') > 0, n('kmYearly') ? `Fuel or charging from ${Math.round(n('kmYearly')).toLocaleString('en-ZA')} km a year` : 'Fuel or charging - put in the distance driven'],
    [n('insurance') > 0, n('insurance') ? `Insurance: ${rand(n('insurance'))} a month${ev ? ' (electric cars often cost more to insure - compare quotes)' : ''}` : 'Insurance - not counted yet; get a quote for this exact car'],
    [n('serviceYearly') > 0 || n('upkeep') > 0, n('serviceYearly') ? `Service: ${rand(n('serviceYearly'))} a year${ev ? ' - far less than a petrol car: no oil, filters or spark plugs' : ''}` : 'The yearly service - not counted yet (check what a service plan covers, and when it ends)'],
    fuel ? [n('oilYearly') > 0, n('oilYearly') ? `Oil between services: ${rand(n('oilYearly'))} a year` : 'Oil top-ups between services - not counted yet'] : null,
    [n('tyresYearly') > 0, n('tyresYearly') ? `Tyres: ${rand(n('tyresYearly'))} a year${ev ? ' - electric cars are heavier and wear them sooner' : ''}` : `Tyres - not counted yet${ev ? '; electric cars wear them sooner' : ''}`],
    [n('licenceYearly') > 0, n('licenceYearly') ? `Licence: ${rand(n('licenceYearly'))} a year` : 'The licence disc - not counted yet'],
    ev || plug ? [n('chargerInstall') > 0, n('chargerInstall') ? `A home charger: ${rand(n('chargerInstall'))} once` : 'A home charger - not counted yet'] : null,
    ev || plug ? [true, 'Public fast charging costs about twice home charging - the more you charge at home, the cheaper it runs'] : null,
    ev || plug ? [true, 'The battery: check the warranty (often 8 years). Used electric car prices in South Africa are less certain - consider a faster drop in value'] : null,
    v.power === 'hybrid' ? [true, 'Hybrids save most in town traffic; on the open road they use about as much as a petrol car'] : null,
    fuel ? [true, `Fuel prices change every month - the price used is ${rand(c.energy.price || 0)} a litre (${ENERGY.source})`] : null,
    [n('upkeep') > 0, n('upkeep') ? `Other repairs: ${rand(n('upkeep'))} a month` : 'Repairs once the warranty ends - brakes, batteries, the unexpected (Advanced)'],
  ].filter(Boolean);
  return el('div', { class: 'panel stack', 'data-field': 'car-forgotten' }, [
    el('h2', { text: 'Did you think of…', style: { margin: 0 } }),
    el('ul', { style: { margin: 0, paddingLeft: 0, listStyle: 'none' } }, items.map(([ok, t]) => el('li', { class: ok ? null : 'muted', text: `${ok ? '✓' : '○'} ${t}` }))),
  ]);
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
      { name: 'Paid out so far', points: outOf(c.timeline.map((t) => [t.month, t.cashOut])) },
      { name: 'Behind, if sold that month', points: outOf(c.timeline.map((t) => [t.month, t.cost])), dashed: true },
    ], { label: 'Money paid out, and how far behind owning it leaves you if sold that month', story: `${RULE} The gap between the lines is what selling would bring back after settling the loan.` }),
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
      { label: 'Runs on', get: (c) => POWER[c.energy.power] },
      { label: 'Fuel or charging, a month now', get: (c) => c.energy.fuelMonth + c.energy.elecMonth, lower: true },
      { label: 'Insurance, service and upkeep, a month now', get: (c) => c.steadyFirstMonth, lower: true },
      { key: 1, label: 'Running costs', get: (c) => c.running, lower: true },
      { label: 'Sale price when sold', get: (c) => c.resale, lower: false },
      { label: 'Still owed then', get: (c) => c.owed, lower: true },
      { key: 1, label: 'Total cost of owning it', get: (c) => c.total, lower: true, total: true },
      { label: 'Cost a month, all in', get: (c) => c.perMonth, lower: true },
    ], { unitNote: lengths.size > 1 ? 'These are kept for different lengths of time, so their totals are not like for like - compare the cost a month, or save them again with the same "keep it for".' : null }),
  ]);
}
