// Money calculators (D-066): small tools, each answering one question, in the
// same Simple / Advanced / Learn shape as the rest of Finance. Each one can be
// saved by name and compared.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { growth, todaysMoney, effectiveYearly, REFERENCE } from '../finance/maths.js';
import { levelBar, shows, draft, loadDraft, input, assumed, stat, sums, step, lineChart, chartPanel, crossing, whenLabel, savedPanel, compareTable, rand, pct } from '../finance/pod.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => r.title, prefix: 'clc' });

/* ---------------------------------------------------- compound interest */

const COMPOUND_DEFAULTS = { start: null, monthly: null, ratePct: 7, years: 10, per: 12, timing: 'end', raisePct: 0, inflationPct: REFERENCE.cpi.value };
const COMPOUND = [
  { key: 'start', label: 'Saved already', type: 'money', level: 'simple', optional: true },
  { key: 'monthly', label: 'Added every month', type: 'money', level: 'simple', optional: true },
  { key: 'ratePct', label: 'Growth', type: 'percent', level: 'simple', source: { kind: 'illustrative' }, hint: 'Before tax and after fees. Savings accounts pay less; shares have averaged more but go up and down - nothing here is promised.' },
  { key: 'years', label: 'For', type: 'years', level: 'simple', source: { kind: 'assumption' } },
  { key: 'inflationPct', label: 'Prices rise by', type: 'percent', level: 'advanced', source: { ref: REFERENCE.cpi }, hint: 'Used to show what the end amount buys in today’s money.' },
  { key: 'raisePct', label: 'Raise what you add each year by', type: 'percent', level: 'advanced', source: { kind: 'assumption' } },
  { key: 'per', label: 'Growth is added', type: 'choice', level: 'advanced', choices: [{ value: 12, label: 'Monthly' }, { value: 1, label: 'Yearly' }, { value: 365, label: 'Daily' }] },
  { key: 'timing', label: 'Money goes in at the', type: 'choice', level: 'advanced', choices: [{ value: 'end', label: 'Month end' }, { value: 'start', label: 'Month start' }] },
];

const TOOLS = [
  { id: 'compound', title: 'Compound interest', question: 'What will my savings grow to - and how much of that is growth?' },
];

export function render(hub, route) {
  if (route.sub === 'compound') return compoundScreen(hub);
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  return el('section', { class: 'stack', 'aria-labelledby': 'calc-title' }, [
    el('h1', { id: 'calc-title', text: 'Money calculators', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Each one answers one question, quickly - with the detail there when you want it.' }),
    el('ul', { class: 'list panel' }, TOOLS.map((t) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href(t.id), 'data-field': `tool:${t.id}`, style: { color: 'inherit', textDecoration: 'none' } }, [el('strong', { text: t.title }), el('div', { class: 'small muted', text: t.question })]),
      el('a', { class: 'btn btn-small', href: hub.href(t.id), text: 'Open' }),
    ]))),
  ]);
}

function compoundScreen(hub) {
  const d = draft('compound', COMPOUND_DEFAULTS);
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...compoundResults(d));
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'ci-title' }, [
    el('h1', { id: 'ci-title', text: 'What will my savings grow to?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Compound interest: growth is added to the savings, and then grows too.' }),
    levelBar(() => hub.render()),
    el('div', { class: 'panel stack' }, [el('h2', { text: 'What we need', style: { margin: 0 } }), ...COMPOUND.filter((f) => shows(f.level)).map((f) => input(f, d, refresh))]),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: 'compound', d, compareScreen: 'compare',
      summary: () => { const g = growth(d.values); return { headline: `${rand(g.balance)} after ${d.values.years} years` }; },
      onOpen: (rec) => { loadDraft('compound', COMPOUND_DEFAULTS, rec); hub.render(); },
    }),
  ]);
}

function compoundResults(d) {
  const v = d.values;
  if (!v.start && !v.monthly) return [el('p', { class: 'panel muted', text: 'Fill in what is saved already, what you add each month, or both.' })];
  if (v.years == null || v.years <= 0 || v.ratePct == null) return [el('p', { class: 'panel muted', text: 'Fill in the growth and for how many years.' })];
  const g = growth(v);
  const real = todaysMoney(g.balance, v.inflationPct, v.years);
  const share = g.balance > 0 ? Math.round((g.growth / g.balance) * 100) : 0;
  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(g.balance), `after ${v.years} years`, 'r-balance'),
      stat(rand(g.paidIn), 'that you put in', 'r-paidin'),
      stat(rand(g.growth), 'of growth', 'r-growth'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      el('p', { style: { margin: 0 }, text: `${share}% of the end amount is growth${g.growth > 0 ? ' - money you did not put in yourself' : ''}. At simple interest (growth never added to the savings) it would be ${rand(g.simpleBalance)}: compounding adds ${rand(g.balance - g.simpleBalance)}.` }),
      el('p', { style: { margin: 0 }, text: `If prices rise ${pct(v.inflationPct)} a year, ${rand(g.balance)} in ${v.years} years buys about what ${rand(real)} buys today.` }),
      el('p', { class: 'small muted', style: { margin: 0 }, text: 'A projection, not a promise: real growth goes up and down, and tax on interest or gains is not included.' }),
    ]),
    (() => {
      const bal = [[0, v.start ?? 0], ...g.rows.map((r) => [r.month, r.balance])];
      const put = [[0, v.start ?? 0], ...g.rows.map((r) => [r.month, r.paidIn])];
      const turn = crossing(g.rows.map((r) => [r.month, r.growth]), g.rows.map((r) => [r.month, r.paidIn]));
      return chartPanel('Year by year', lineChart([{ name: 'Savings', points: bal }, { name: 'Put in', points: put, dashed: true }], {
        label: 'Savings against what was put in, year by year',
        marks: [turn != null ? { x: turn, label: `Growth bigger than all put in, ${whenLabel(turn)}` } : null],
        story: 'The gap between the lines is growth. It widens faster every year - that is compounding.' }));
    })(),
    assumed(COMPOUND, d),
    compoundLevers(v, g),
  ];
  if (shows('advanced')) {
    out.push(el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Year by year', style: { margin: 0 } }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['Year', 'Put in', 'Growth', 'Savings'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, g.rows.map((r) => el('tr', {}, [el('td', { text: String(Math.ceil(r.month / 12)) }), ...[r.paidIn, r.growth, r.balance].map((x) => el('td', { class: 'num', text: rand(x) }))]))),
      ])]),
      el('p', { class: 'small', style: { margin: 0 }, text: `${pct(v.ratePct)} a year added ${({ 12: 'monthly', 1: 'yearly', 365: 'daily' })[v.per]} is ${pct(effectiveYearly(v.ratePct, v.per), 3)} a year once growth on growth is counted.` }),
    ]));
  }
  if (shows('learn')) out.push(compoundLearn(v, g));
  return out.filter(Boolean);
}

function compoundLevers(v, g) {
  const tries = [];
  const longer = growth({ ...v, years: v.years + 5 });
  tries.push(`Five more years: ${rand(longer.balance)} - ${rand(longer.growth - g.growth)} more growth for ${rand(longer.paidIn - g.paidIn)} more put in.`);
  if (v.monthly) { const more = growth({ ...v, monthly: v.monthly + 500 }); tries.push(`R500 more a month: ${rand(more.balance)}.`); }
  const lower = growth({ ...v, ratePct: Math.max(0, v.ratePct - 2) });
  tries.push(`If growth is 2 points lower: ${rand(lower.balance)}.`);
  return el('div', { class: 'panel stack' }, [el('h2', { text: 'What would change it', style: { margin: 0 } }), el('ul', { style: { margin: 0 } }, tries.map((t) => el('li', { text: t })))]);
}

function compoundLearn(v, g) {
  const r = v.per === 12 ? v.ratePct / 1200 : (1 + v.ratePct / 100 / v.per) ** (v.per / 12) - 1;
  const n = g.months;
  const plain = !v.raisePct;
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    step('1. The rate each month', v.per === 12 ? 'r = yearly rate ÷ 12' : `r = (1 + yearly rate ÷ ${v.per})^(${v.per} ÷ 12) − 1`, `r = ${(r * 100).toFixed(4)}% a month`,
      v.per === 12 ? null : 'Growth added more or less often than monthly is turned into the monthly rate that gives the same yearly result.'),
    step('2. What is saved already grows', 'S × (1+r)^n', `${rand(v.start ?? 0)} × (1+${(r * 100).toFixed(4)}%)^${n} = ${rand((v.start ?? 0) * (1 + r) ** n)}`, `n = ${n} months.`),
    plain ? step('3. Each monthly amount grows for the months left after it', v.timing === 'start' ? 'M × ((1+r)^n − 1) ÷ r × (1+r)' : 'M × ((1+r)^n − 1) ÷ r',
      `${rand(v.monthly ?? 0)} × ((1+${(r * 100).toFixed(4)}%)^${n} − 1) ÷ ${(r * 100).toFixed(4)}% = ${rand((v.monthly ?? 0) * (r ? ((1 + r) ** n - 1) / r : n) * (v.timing === 'start' ? 1 + r : 1))}`,
      'Paying in at the start of a month gives every payment one more month of growth.')
      : step('3. Each monthly amount grows for the months left after it', 'Worked month by month', null, `Because what you add rises ${pct(v.raisePct)} each year, there is no single formula: each month adds that month’s amount and then grows, and the total is ${rand(g.balance - (v.start ?? 0) * (1 + r) ** n)}.`),
    step('4. Total', 'Savings = 2 + 3', `${rand(g.balance)}`),
    step('Simple interest, for comparison', 'Each rand only ever earns on itself: amount × rate × time', `${rand(g.simpleBalance)}`, 'The difference is growth earning growth - small at first, large over long periods. The rule of 72: at r% a year, money doubles in about 72 ÷ r years' + (v.ratePct ? ` - here about ${(72 / v.ratePct).toFixed(1)} years.` : '.')),
    step('In today’s money', 'Today’s money = amount ÷ (1 + inflation)^years', `${rand(g.balance)} ÷ (1+${pct(v.inflationPct)})^${v.years} = ${rand(todaysMoney(g.balance, v.inflationPct, v.years))}`),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'The growth rate is held steady. Real returns vary from year to year, and a bad year near the end matters more than one near the start.',
      'Tax on interest, dividends or gains, and any fees not already in the rate.',
      'With yearly or daily growth, it uses the equivalent monthly rate - very close to, but not exactly, how every bank credits interest.',
    ].map((t) => el('li', { text: t }))),
  ]);
}

/* ------------------------------------------------------------- compare */

function compareScreen(hub, param) {
  const ids = param.split(',').filter(Boolean);
  const r = hub.use(`compare:${param}`, async () => (await Promise.all(ids.map((id) => col(hub).get(id)))).filter(Boolean));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const items = r.data.filter((rec) => rec.kind === 'compound').map((rec) => {
    const v = { ...COMPOUND_DEFAULTS, ...rec.values };
    const g = growth(v);
    return { title: rec.title, out: { ...g, years: v.years, real: todaysMoney(g.balance, v.inflationPct, v.years) } };
  });
  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    el('h1', { id: 'cmp-title', text: 'Side by side', style: { margin: 0 } }),
    items.length < 2 ? el('p', { class: 'panel', text: 'Two or more saved calculations are needed to compare.' }) : compareTable(items, [
      { label: 'Years', get: (o) => `${o.years}` },
      { key: 1, label: 'Put in', get: (o) => o.paidIn, lower: true },
      { key: 1, label: 'Growth', get: (o) => o.growth, lower: false },
      { key: 1, label: 'Savings at the end', get: (o) => o.balance, lower: false, total: true },
      { label: 'In today’s money', get: (o) => o.real, lower: false },
    ]),
  ]);
}
