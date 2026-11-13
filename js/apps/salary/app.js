// Salary and costs (D-119): the salary you started on, the raises you have had,
// and your own costs each rising at their own rate - is the salary keeping up?
// Then on into the years ahead, with the life events you plan, against the
// raises you are getting. Arithmetic on the family's own numbers - not advice.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { shows, draft, loadDraft, inputsPanel, stat, step, lineChart, chartPanel, barsChart, savedPanel, rand, pct } from '../finance/pod.js';
import { normaliseMonth, monthId } from '../finance/logic.js';
import { SARS } from '../jobs/logic.js';
import { DEFAULTS, KINDS, SCHEMES, RENT, CPI, plan, whatMoves, startingRate, futureRaise, costsFromBudget, addMonth, monthsBetween } from './logic.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'sal' });
const KIND = 'salary';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
let n = 0;
const newId = (p) => `${p}${Date.now().toString(36)}${(n += 1)}`;

const FIELDS = [
  { key: 'salary', label: 'The salary you started on', type: 'money', level: 'simple', info: 'What the job paid when you started it - from your first payslip or the offer letter. A year or a month, before or after tax: choose below.' },
  { key: 'salaryPer', label: 'That is', type: 'choice', level: 'simple', choices: [{ value: 'year', label: 'A year' }, { value: 'month', label: 'A month' }] },
  { key: 'salaryKind', label: 'Before or after tax', type: 'choice', level: 'simple', choices: [{ value: 'gross', label: 'Before tax' }, { value: 'takehome', label: 'Take-home' }], info: `Before tax: the take-home is estimated with the ${SARS.source}, every year at the salary of that year. Take-home from a payslip is firmer.` },
  { key: 'start', label: 'When you started', type: 'month', level: 'simple', hint: 'Empty: today - a new job, looking ahead only.' },
  { key: 'raisePct', label: 'Raises from now on', type: 'percent', level: 'simple', estimate: () => CPI.future, info: `What you expect each year from here. Left empty it is ${pct(CPI.future)}, the inflation rate (${CPI.source}) - a raise is never promised; look at what you have really had.` },
  { key: 'ahead', label: 'Look ahead', type: 'choice', level: 'simple', choices: [5, 10, 20].map((y) => ({ value: y, label: `${y} years` })) },
];

export function render(hub) {
  const d = draft(KIND, { ...DEFAULTS, costs: [], events: [], raises: [] });
  const today = hub.today();
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...results(hub, d).filter(Boolean));
  const lists = el('div', { class: 'stack' });
  const redraw = () => { lists.replaceChildren(...[raisesPanel(d, today, refresh), costsPanel(hub, d, today, refresh, redraw), eventsPanel(d, refresh, redraw)].filter(Boolean)); refresh(); };
  // A new start month changes how many raises there are and whether "now" applies.
  const onInput = (key) => (key === 'start' ? redraw() : refresh());
  redraw();
  return el('section', { class: 'stack', 'aria-labelledby': 'sal-title' }, [
    el('h1', { id: 'sal-title', text: 'Is your salary keeping up?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'The salary you started on and your raises, against your own costs - rent, medical aid, petrol and the rest, each rising at its own rate. Then the years ahead, with what you plan: getting married, children.' }),
    inputsPanel(FIELDS, d, {}, onInput),
    lists,
    answer,
    savedPanel(hub, {
      col: col(hub), kind: KIND, d,
      summary: () => { const p = plan(d.values, today); return p.missing ? {} : { headline: `${rand(p.at(p.T).takeHome)} take-home · ${rand(Math.abs(p.at(p.T).gap))} ${p.at(p.T).gap < 0 ? 'short' : 'more than needed'} a month now` }; },
      onOpen: (rec) => { loadDraft(KIND, DEFAULTS, rec); hub.render(); },
    }),
  ]);
}

const start = (d, today) => (/^\d{4}-\d{2}$/.test(d.values.start ?? '') && d.values.start < today.slice(0, 7) ? d.values.start : null);
const past = (d, today) => { const s = start(d, today); return s ? monthsBetween(s, today.slice(0, 7)) : 0; };
const mine = (d, key) => d.mine.add(key);

/* -------------------------------------------------------- the raises */

function raisesPanel(d, today, refresh) {
  const s = start(d, today);
  const count = Math.floor(past(d, today) / 12);
  if (!s || !count) return null;
  const list = d.values.raises = Array.isArray(d.values.raises) ? d.values.raises : [];
  return el('div', { class: 'panel stack', 'data-field': 'raises-panel' }, [
    el('h2', { text: 'The raises you have had', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'On each anniversary of starting. Empty: no raise that year.' }),
    ...Array.from({ length: count }, (_, i) => el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
      el('label', { class: 'small', for: `raise-${i}`, text: monthName(addMonth(s, 12 * (i + 1))), style: { minWidth: '130px' } }),
      el('input', { class: 'input', id: `raise-${i}`, type: 'number', inputmode: 'decimal', step: 'any', value: list[i] ?? '', placeholder: 'no raise', 'data-field': `raise:${i}`, style: { maxWidth: '110px' },
        on: { input: (e) => { list[i] = e.target.value === '' ? null : Number(e.target.value); mine(d, 'raises'); refresh(); } } }),
      el('span', { class: 'small muted', text: '%' }),
    ])),
  ]);
}

/* --------------------------------------------------------- the costs */

function rateNote(c) {
  if (num(c.pct) != null) return 'Yours';
  const r = startingRate(c);
  return `Estimated ${pct(r.pct)} - ${r.source}`;
}

function costsPanel(hub, d, today, refresh, redraw) {
  const list = d.values.costs = Array.isArray(d.values.costs) ? d.values.costs : [];
  const s = start(d, today);
  const changed = (structure) => { mine(d, 'costs'); if (structure) redraw(); else refresh(); };
  const field = (c, key, attrs) => el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: 'any', value: c[key] ?? '', style: { maxWidth: '130px' }, ...attrs,
    on: { input: (e) => { c[key] = e.target.value === '' ? null : Number(e.target.value); changed(false); } } });
  const fromBudget = async () => {
    const month = today.slice(0, 7);
    const rec = hub.data.installed('finance') ? await hub.data.of('finance', 'months').get(monthId(month)) : null;
    const got = rec ? costsFromBudget(normaliseMonth(rec, month)) : [];
    if (!got.length) { hub.ui.notice(`Nothing planned in ${monthName(month)}’s budget yet.`); return; }
    if (list.length && !(await confirmAction({ title: 'Use this month’s budget?', text: 'Your costs here are replaced with the budget’s categories and amounts.', confirmLabel: 'Use budget' }))) return;
    list.splice(0, list.length, ...got);
    hub.ui.notice(s ? 'Taken from the budget as it is now: put each one in as "Now", and what it was when you started as the amount.' : 'Taken from the budget.');
    if (s) for (const c of list) { c.now = c.amount; c.amount = null; }
    changed(true);
  };
  return el('div', { class: 'panel stack', 'data-field': 'costs-panel' }, [
    el('h2', { text: 'Your costs', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: s
      ? `A month, when you started in ${monthName(s)}. "Now" is what it costs today: from the two, the app works out how fast it rose for you. Leave "Now" empty to use the starting rate. Add "Everything else" for what is not its own line.`
      : 'A month, today. Each rises at its own rate - yours, or a starting rate labelled Estimated. Add "Everything else" for what is not its own line.' }),
    ...list.map((c, i) => el('fieldset', { class: 'stack fin-group', 'data-field': `cost:${i}` }, [
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('input', { class: 'input', value: c.name ?? '', placeholder: KINDS[c.kind] ?? 'What it is', 'aria-label': 'What the cost is', style: { flex: '1 1 160px' }, on: { input: (e) => { c.name = e.target.value; changed(false); } } }),
        el('select', { class: 'select', 'aria-label': 'Rises like', style: { width: 'auto' }, on: { change: (e) => { c.kind = e.target.value; changed(true); } } },
          Object.entries(KINDS).map(([k, label]) => el('option', { value: k, text: label, selected: (c.kind ?? 'other') === k }))),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${c.name || KINDS[c.kind] || 'this cost'}`, on: { click: () => { list.splice(i, 1); changed(true); } } }),
      ]),
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('span', { class: 'muted', text: 'R' }), field(c, 'amount', { placeholder: s ? 'then' : 'a month', 'aria-label': s ? 'A month when you started' : 'A month' }),
        s ? el('span', { class: 'small muted', text: 'now R' }) : null,
        s ? field(c, 'now', { placeholder: 'now', 'aria-label': 'A month now' }) : null,
      ]),
      c.kind === 'medical' ? el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('label', { class: 'small', text: 'Scheme' }),
        el('select', { class: 'select', 'aria-label': 'Medical scheme', style: { width: 'auto' }, on: { change: (e) => { c.scheme = e.target.value || null; changed(true); } } },
          [el('option', { value: '', text: 'Another, or not sure' }), ...Object.entries(SCHEMES).map(([k, x]) => el('option', { value: k, text: x.label, selected: c.scheme === k }))]),
      ]) : null,
      c.kind === 'rent' ? el('div', { class: 'chipset', role: 'group', 'aria-label': 'Where' }, [['national', `South Africa ${pct(RENT.national)}`], ['wc', `Western Cape ${pct(RENT.wc)}`]].map(([k, label]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String((c.region ?? 'national') === k), text: label, on: { click: () => { c.region = k; changed(true); } } }))) : null,
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('span', { class: 'small', text: 'From now on' }), field(c, 'pct', { placeholder: String(startingRate(c).pct), 'aria-label': 'Rises from now on, % a year', style: { maxWidth: '100px' } }),
        el('span', { class: 'small muted', text: '% a year' }),
      ]),
      el('div', { class: 'fin-tag', text: rateNote(c) }),
    ])),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-small', type: 'button', text: 'Add cost', 'data-field': 'cost-add', on: { click: () => { list.push({ id: newId('c'), kind: 'other', name: '', amount: null }); changed(true); } } }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'From budget', title: 'Take the categories from this month’s budget', 'data-field': 'from-budget', on: { click: fromBudget } }),
    ]),
  ]);
}

/* ----------------------------------------------------- life events */

const EVENTS = {
  married: { label: 'Married', think: 'Think about: a medical aid dependant, more food, a bigger home or car. Their income is a line of its own (Income).' },
  child: { label: 'A child', think: 'Think about: medical aid for them, nappies and formula, crèche or childcare, more food, and school fees later - a line of its own from the year school starts.' },
  medical: { label: 'Medical aid', think: 'Someone added to the medical aid: what it adds a month.' },
  move: { label: 'Move house', think: 'The new rent or bond less the old - a minus amount if it costs less.' },
  other: { label: 'Something else', think: '' },
  income: { label: 'Income', think: 'Money coming in: a partner’s take-home, in today’s money.' },
};

function eventsPanel(d, refresh, redraw) {
  const list = d.values.events = Array.isArray(d.values.events) ? d.values.events : [];
  const costs = (d.values.costs ?? []).filter((c) => num(c.amount) > 0);
  const changed = (structure) => { mine(d, 'events'); if (structure) redraw(); else refresh(); };
  return el('div', { class: 'panel stack', 'data-field': 'events-panel' }, [
    el('h2', { text: 'Life events', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'What each adds a month, in today’s money, from its date - past or planned. One line for each cost, so each rises the way it really does.' }),
    ...list.map((e, i) => el('fieldset', { class: 'stack fin-group', 'data-field': `event:${i}` }, [
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('select', { class: 'select', 'aria-label': 'What happens', style: { width: 'auto' }, on: { change: (x) => { e.kind = x.target.value; changed(true); } } },
          Object.entries(EVENTS).map(([k, x]) => el('option', { value: k, text: x.label, selected: e.kind === k }))),
        el('input', { class: 'input', value: e.what ?? '', placeholder: 'What, e.g. crèche', 'aria-label': 'What it is', style: { flex: '1 1 140px' }, on: { input: (x) => { e.what = x.target.value; changed(false); } } }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': 'Remove this event', on: { click: () => { list.splice(i, 1); changed(true); } } }),
      ]),
      el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
        el('span', { class: 'small muted', text: 'from' }),
        el('input', { class: 'input', type: 'month', value: e.from ?? '', 'aria-label': 'From', style: { maxWidth: '170px' }, on: { change: (x) => { e.from = x.target.value || null; changed(false); } } }),
        el('span', { class: 'muted', text: 'R' }),
        el('input', { class: 'input', type: 'number', step: 'any', value: e.amount ?? '', placeholder: 'a month', 'aria-label': 'A month, in today’s money', style: { maxWidth: '120px' }, on: { input: (x) => { e.amount = x.target.value === '' ? null : Number(x.target.value); changed(false); } } }),
        el('span', { class: 'small muted', text: e.kind === 'income' ? 'grows like' : 'rises like' }),
        el('select', { class: 'select', 'aria-label': 'Rises like', style: { width: 'auto' }, on: { change: (x) => { e.risesWith = x.target.value; changed(false); } } },
          [el('option', { value: 'cpi', text: 'Prices (CPI)' }), ...costs.map((c) => el('option', { value: c.id, text: c.name || KINDS[c.kind], selected: e.risesWith === c.id }))]),
      ]),
      EVENTS[e.kind]?.think ? el('p', { class: 'small muted', style: { margin: 0 }, text: EVENTS[e.kind].think }) : null,
    ])),
    el('div', {}, [el('button', { class: 'btn btn-small', type: 'button', text: 'Add event', 'data-field': 'event-add', on: { click: () => { list.push({ id: newId('e'), kind: 'child', from: null, amount: null, risesWith: 'cpi' }); changed(true); } } })]),
  ]);
}

/* ---------------------------------------------------------- results */

const yearOf = (p) => (x) => addMonth(p.start, Math.round(x)).slice(0, 4);
const more = (x) => (x >= 0 ? 'more' : 'less');

function results(hub, d) {
  const today = hub.today();
  const v = d.values;
  const p = plan(v, today);
  if (p.missing) return [el('p', { class: 'panel muted', text: `Fill in ${p.missing.join(' and ')} to see the answer.` })];
  const now = p.at(p.T); const first = p.at(0); const end = p.at(p.N);
  const hasCosts = p.basket0 > 0;
  const by = hasCosts ? 'by your own costs' : 'by prices in general (CPI) - add your costs to use your own';
  const realChange = (now.real / first.takeHome - 1) * 100;
  const cpiChange = (now.realCpi / first.takeHome - 1) * 100;
  const yearly = (f) => (p.T >= 12 ? (f ** (12 / p.T) - 1) * 100 : null);
  const lines = [];
  if (p.T > 0) {
    lines.push(`Your take-home now, ${rand(now.takeHome)} a month, buys about ${rand(now.real)} of what it bought in ${monthName(p.start)} - when it was ${rand(first.takeHome)}. That is about ${pct(Math.abs(realChange), 1)} ${more(realChange)}, ${by}.`);
    if (hasCosts) lines.push(`By CPI alone it would be about ${pct(Math.abs(cpiChange), 1)} ${more(cpiChange)}.${yearly(now.own) != null ? ` Your own costs rose about ${pct(yearly(now.own), 1)} a year; CPI about ${pct(yearly(now.cpi), 1)}.` : ''}`);
  }
  const endName = monthName(addMonth(p.start, p.N));
  lines.push(`With raises of ${pct(futureRaise(v))} a year, by ${endName} your take-home would be about ${rand(end.takeHome)} a month, against about ${rand(end.needed)} needed ${hasCosts ? `for your costs${(v.events ?? []).length ? ', your life events' : ''} and what was left over at the start (${rand(p.left0)}, kept in step with your prices)` : `to buy what your take-home bought at the start, by CPI${(v.events ?? []).length ? ', and your life events' : ''} - add your costs to use your own prices`}. ${Math.abs(end.gap) < 1 ? 'About the same.' : end.gap < 0 ? `That is ${rand(-end.gap)} a month short.` : `That leaves ${rand(end.gap)} a month more than needed.`}`);
  if (p.shortFrom === p.T) lines.push(`Already today the take-home is ${rand(-now.gap)} a month less than what is needed.`);
  else if (p.shortFrom != null) lines.push(`From ${monthName(addMonth(p.start, p.shortFrom))} the take-home is less than what is needed.`);
  if (p.estimated) lines.push(`Take-home is estimated from the salary with the ${SARS.source}, held for every year - so tax takes a little more of each raise. SARS often moves the bands up with inflation, which would close part of any gap. A payslip figure is firmer.`);

  const marks = [{ x: p.T, label: 'Today' }, ...(v.events ?? []).filter((e) => e.from && num(e.amount)).map((e) => ({ x: monthsBetween(p.start, e.from), label: e.what || EVENTS[e.kind]?.label || 'Event' }))];
  const pts = (get) => p.rows.map((r) => [r.m, get(r)]);
  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(now.takeHome), p.estimated ? 'take-home a month now (estimated)' : 'take-home a month now', 's-takehome'),
      p.T > 0 ? stat(rand(now.real), `buys what this bought in ${monthName(p.start)}`, 's-real') : null,
      stat(rand(end.needed), `needed a month by ${endName}`, 's-needed'),
      stat(rand(Math.abs(end.gap)), end.gap < 0 ? 'short a month then' : 'more than needed then', 's-gap'),
    ].filter(Boolean)),
    el('div', { class: 'panel stack' }, [el('h2', { text: 'What it means', style: { margin: 0 } }), ...lines.map((t) => el('p', { style: { margin: 0 }, text: t }))]),
    chartPanel('Is your salary keeping up with your own costs?', lineChart([
      { name: hasCosts ? 'By your own costs' : 'By CPI', points: pts((r) => (r.real / first.takeHome - 1) * 100) },
      hasCosts ? { name: 'By CPI only', points: pts((r) => (r.realCpi / first.takeHome - 1) * 100), dashed: true } : null,
    ].filter(Boolean), { label: `What your take-home buys, more or less than in ${monthName(p.start)}, month by month`, marks, xLabel: yearOf(p), percent: true,
      zones: { above: 'Buys more than at the start', below: 'Buys less' },
      story: 'Zero is what your take-home bought when you started. Above it your take-home buys more of your own costs; below it, less. Each step up is a raise.' })),
    chartPanel('What salary would you need, year by year?', lineChart([
      { name: 'Needed', points: pts((r) => r.needed) },
      { name: 'Your take-home', points: pts((r) => r.takeHome) },
    ], { label: 'The take-home needed against the take-home with your raises', marks: [...marks, p.shortFrom > p.T ? { x: p.shortFrom, label: 'Short from here' } : null], xLabel: yearOf(p),
      story: 'Needed: your costs and life events, less any income they add, plus what was left over at the start. Where your take-home is under it, the gap is what is short each month.' })),
  ];
  if (shows('advanced')) out.push(advanced(v, p, today));
  if (shows('learn')) out.push(learn(v, p));
  out.push(el('p', { class: 'small muted', style: { margin: 0 }, text: 'Arithmetic on your own figures and the starting rates shown - not a prediction and not financial advice. Raises and prices ahead are assumptions.' }));
  return out;
}

function advanced(v, p, today) {
  const moves = whatMoves(v, today, p.N);
  return el('div', { class: 'stack' }, [
    p.T > 0 && p.where.length ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Where did the extra go?', style: { margin: 0 } }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['', monthName(p.start), 'Now', 'More a month'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, p.where.map((w) => el('tr', {}, [el('td', { text: w.name }), ...[w.start, w.now, w.change].map((x) => el('td', { class: 'num', text: rand(x) }))]))),
      ])]),
    ]) : null,
    moves.length > 1 ? chartPanel('What could change the answer?', barsChart(moves.map((m) => ({ label: m.label, low: m.low, high: m.high })), { label: `Each rate 2 points lower and higher: how much the monthly gap in ${monthName(addMonth(p.start, p.N))} moves`, worse: 'short by more', better: 'more left' }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'Each rate from now on, 2 points either side, on its own. Longest first: what matters most to the answer.' })) : null,
    el('details', { class: 'panel more' }, [
      el('summary', { text: 'Year by year' }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['', 'Raise', 'Salary', 'Take-home', 'Your prices rose', 'CPI', 'In start prices', 'Costs and events', 'Needed', 'Short or more'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, p.years.map((r) => el('tr', { class: r.today ? 'fin-sums__total' : null }, [
          el('td', { text: `${monthName(r.month)}${r.today ? ' (today)' : ''}` }),
          el('td', { class: 'num', text: r.raise == null ? '-' : pct(r.raise) }),
          ...[r.salary, r.takeHome].map((x) => el('td', { class: 'num', text: rand(x) })),
          ...[r.ownPct, r.cpiPct].map((x) => el('td', { class: 'num', text: x == null ? '-' : pct(x, 1) })),
          ...[r.real, r.basket + r.added - r.income, r.needed, r.gap].map((x) => el('td', { class: 'num', text: rand(x) })),
        ]))),
      ])]),
    ]),
  ]);
}

function learn(v, p) {
  const now = p.at(p.T);
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    step('Salary', 'The start salary × (1 + each raise), on each anniversary of starting', `${rand(now.salary)} a month now`),
    step('A cost', 'Past: (now ÷ then) spread evenly over the months since you started; without "now", each calendar year’s starting rate. From now on: your % or its starting rate, a twelfth of the year’s rise each month', null, `CPI: ${CPI.source}. Rent: ${RENT.source}.`),
    step('Your own inflation', 'All your costs now ÷ the same costs when you started', `${pct((now.own - 1) * 100, 1)} since ${monthName(p.start)}`),
    step('What your salary buys', 'Take-home ÷ your own inflation', `${rand(now.takeHome)} ÷ ${now.own.toFixed(3)} = ${rand(now.real)}`),
    step('Needed', 'Your costs + life events − income they add + what was left over at the start × your own inflation', `${rand(now.needed)} a month now`),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'Raises are counted on each anniversary of starting; many come in March or at a review date instead.',
      'The SARS tables are held at 2026/27 for every year. Before then the bands were a little lower; later SARS usually raises them.',
      'A cost you did not list is not counted - "Everything else" catches the rest.',
      'Life events are in today’s money from their date, rising like the cost you chose.',
    ].map((t) => el('li', { text: t }))),
  ]);
}
