// Job offers (D-068): each job - the one you have, and each offer - saved by name,
// then compared on what actually reaches the household, over the years, with the
// cost of moving and how long it takes to earn back.

import { el } from '../../ui/dom.js';
import { loading, failure } from '../kit.js';
import { REFERENCE } from '../finance/maths.js';
import { levelBar, shows, draft, loadDraft, inputsPanel, assumed, stat, sums, step, lineChart, savedPanel, compareTable, rand, pct, months } from '../finance/pod.js';
import { OFFER_DEFAULTS, SARS, estimatePay, project, moveCash, versus, bandTax } from './logic.js';

const col = (hub) => hub.data.collection('saved', { summary: (r) => ({ title: r.title, kind: r.kind, savedAt: r.savedAt, headline: r.result?.headline }), text: (r) => `${r.title} ${r.values?.notes ?? ''}`, prefix: 'job' });
const KIND = 'offer';
const DEFAULTS = { ...OFFER_DEFAULTS, monthsToMove: null };

const FIELDS = [
  { key: 'grossMonthly', label: 'Salary a month, before tax', type: 'money', level: 'simple' },
  { key: 'takeHome', label: 'Take-home a month, from a payslip', type: 'money', level: 'simple', estimate: () => null, hint: 'What reaches the bank account. Left empty, it is estimated from the salary with the SARS tables.' },
  { key: 'raisePct', label: 'Yearly increase', type: 'percent', level: 'simple', source: { ref: REFERENCE.cpi, note: '(assumed: increases are never promised)' } },
  { key: 'commute', label: 'Getting to work a month', type: 'money', level: 'simple', optional: true, group: 'costs', hint: 'Finance › Homes › A home works this out from the distance.' },
  { key: 'livingChange', label: 'Other monthly costs that change with this job', type: 'money', level: 'simple', optional: true, min: null, group: 'costs', hint: 'More rent, childcare or school fees: a plus amount. Less: a minus amount. Leave empty for the job you have now.' },
  { key: 'moveCost', label: 'Moving costs', type: 'money', level: 'simple', optional: true, group: 'move', hint: 'Removals, travel, temporary stay, setting up - money that does not come back.' },
  { key: 'moveAllowance', label: 'Paid by the employer', type: 'money', level: 'simple', optional: true, group: 'move' },
  { key: 'moveRefundable', label: 'Deposits that come back later', type: 'money', level: 'advanced', optional: true, group: 'move', hint: 'A rental deposit: cash needed before the move, but not a cost.' },
  { key: 'allowanceBefore', label: 'The employer pays before the move', type: 'check', level: 'advanced', group: 'move' },
  { key: 'gapMonths', label: 'Months without pay between jobs', type: 'number', level: 'advanced', optional: true, group: 'move' },
  { key: 'savedForMove', label: 'Saved for the move already', type: 'money', level: 'simple', optional: true, group: 'move' },
  { key: 'canSave', label: 'Can put aside each month now', type: 'money', level: 'simple', optional: true, group: 'move', hint: 'From your budget as it is - not from the new salary.' },
  { key: 'monthsToMove', label: 'Months until the move', type: 'number', level: 'simple', optional: true, group: 'move' },
  { key: 'raiseAfter', label: 'First increase after', type: 'months', level: 'advanced', source: { kind: 'assumption' }, hint: 'Months until the first review - after probation, or at the yearly review date.' },
  { key: 'bonusGuaranteed', label: 'Guaranteed bonus a year (13th cheque)', type: 'money', level: 'advanced', optional: true, group: 'pay' },
  { key: 'bonusPerformance', label: 'Performance bonus a year, if paid', type: 'money', level: 'advanced', optional: true, group: 'pay', hint: 'Shown on its own - never counted as if it were certain.' },
  { key: 'allowances', label: 'Allowances paid in cash a month', type: 'money', level: 'advanced', optional: true, group: 'pay', hint: 'Car, housing or cell phone allowances. Taxed like salary here; a car allowance may be taxed less.' },
  { key: 'employerRetirement', label: 'Employer’s pension or provident contribution a month', type: 'money', level: 'advanced', optional: true, group: 'pay' },
  { key: 'employeeRetirement', label: 'Your own retirement contribution a month', type: 'money', level: 'advanced', optional: true, group: 'pay' },
  { key: 'employerMedical', label: 'Employer’s medical aid contribution a month', type: 'money', level: 'advanced', optional: true, group: 'pay' },
  { key: 'medicalOwn', label: 'Your share of medical aid a month', type: 'money', level: 'advanced', optional: true, group: 'pay' },
  { key: 'medicalMembers', label: 'People on the medical aid', type: 'number', level: 'advanced', source: { kind: 'assumption' }, group: 'pay', hint: 'For the SARS medical tax credit.' },
  { key: 'otherBenefits', label: 'Other benefits, worth a month', type: 'money', level: 'advanced', optional: true, group: 'pay', hint: 'A company car, housing, a phone - part of the package, not cash.' },
  { key: 'benefitSaves', label: 'Costs those benefits save you a month', type: 'money', level: 'advanced', optional: true, group: 'pay', hint: 'A company car may save your own car’s costs - counted for the household.' },
  { key: 'age', label: 'Your age', type: 'choice', level: 'advanced', group: 'pay', choices: [{ value: 'under65', label: 'Under 65' }, { value: 'over65', label: '65 to 74' }, { value: 'over75', label: '75 or older' }] },
  { key: 'escalatePct', label: 'Costs and prices rise by', type: 'percent', level: 'advanced', source: { ref: REFERENCE.cpi }, group: 'costs' },
  { key: 'growthPct', label: 'Retirement savings grow by', type: 'percent', level: 'advanced', source: { kind: 'illustrative' }, group: 'pay' },
  { key: 'notes', label: 'What is not about money', type: 'text', level: 'simple', group: 'notes', placeholder: 'Work you enjoy, hours, travel time, growth, security, time with family…' },
];
const GROUPS = { pay: 'Pay and benefits', costs: 'Costs this job brings', move: 'Moving (only if this job means moving)', notes: 'Worth weighing' };

export function render(hub, route) {
  if (route.sub === 'compare') return compareScreen(hub, route.rest[0] ?? '');
  return offerScreen(hub);
}

function offerScreen(hub) {
  const d = draft(KIND, DEFAULTS);
  const answer = el('div', { class: 'stack', 'aria-live': 'polite' });
  const refresh = () => answer.replaceChildren(...results(d).filter(Boolean));
  refresh();
  return el('section', { class: 'stack', 'aria-labelledby': 'jobs-title' }, [
    el('h1', { id: 'jobs-title', text: 'What does this job really leave us?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Not the headline salary: what reaches the bank, what the job costs, and what moving takes. Save the job you have now and each offer by name, then compare them.' }),
    levelBar(() => hub.render()),
    inputsPanel(FIELDS, d, GROUPS, refresh),
    answer,
    savedPanel(hub, {
      col: col(hub), kind: KIND, d, compareScreen: 'compare',
      summary: () => { const p = project(d.values, 12); return p.missing ? {} : { headline: `${rand(p.first.takeHome)} take-home · ${rand(p.first.household)} left a month` }; },
      onOpen: (rec) => { loadDraft(KIND, DEFAULTS, rec); hub.render(); },
    }),
  ]);
}

const num = (v) => Number(v) || 0;

function results(d) {
  const v = d.values;
  const p = project(v, 120);
  if (p.missing) return [el('p', { class: 'panel muted', text: `Fill in ${p.missing.join(' or ')} to see the answer.` })];
  const e = p.estimate;
  const f = p.first;
  const mv = moveCash(v);
  const moving = mv.cost > 0 || mv.refundable > 0;
  const lines = [
    p.estimated
      ? `Take-home is estimated with the ${SARS.source}: about ${rand(e.tax / 12)} tax and ${rand(e.uif / 12)} UIF a month${num(v.employeeRetirement) ? `, ${rand(num(v.employeeRetirement))} to your retirement fund` : ''}${num(v.medicalOwn) ? `, ${rand(num(v.medicalOwn))} to medical aid` : ''}. A payslip figure is better - when you have one, enter it.`
      : 'Take-home is the payslip figure you entered.',
    `The package is worth about ${rand(f.package)} a month; ${rand(f.takeHome)} of it reaches the bank${num(v.employerRetirement) ? `, and ${rand(num(v.employerRetirement))} goes to retirement - yours, but not to spend now` : ''}.`,
    `After this job’s own costs, it leaves the household about ${rand(f.household)} a month.`,
    num(v.bonusPerformance) ? `A performance bonus of ${rand(num(v.bonusPerformance))} a year is not counted, because it is not certain. If paid, about ${rand(p.perfNet)} of it would be left after tax.` : null,
  ];
  if (moving) {
    const fits = num(v.monthsToMove) > 0 && mv.monthsToSave != null ? mv.monthsToSave <= num(v.monthsToMove) : null;
    lines.push(`Moving needs ${rand(mv.needed)} in cash before the move${mv.refundable ? ` (${rand(mv.refundable)} of it comes back later)` : ''}. ${mv.short <= 0 ? 'What is saved covers it.' : mv.monthsToSave == null ? `${rand(mv.short)} is still missing, and nothing can be put aside each month yet.` : `${rand(mv.short)} is still missing: about ${months(mv.monthsToSave)} at ${rand(num(v.canSave))} a month.`}${fits === false ? ` That is longer than the ${months(num(v.monthsToMove))} until the move.` : fits ? ' That fits before the move.' : ''}`);
  }
  const out = [
    el('div', { class: 'stats' }, [
      stat(rand(f.takeHome), p.estimated ? 'take-home a month (SARS estimate)' : 'take-home a month (payslip)', 'r-takehome'),
      stat(rand(f.package), 'total package a month', 'r-package'),
      stat(rand(f.household), 'left for the household a month', 'r-household'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      ...lines.filter(Boolean).map((t) => el('p', { style: { margin: 0 }, text: t })),
      sums([
        p.estimated ? { label: 'Pay before tax', value: e.pay / 12, note: num(v.bonusGuaranteed) ? 'Salary, allowances and the guaranteed bonus spread over the year' : null } : null,
        p.estimated ? { label: 'Less tax (SARS estimate)', value: -e.tax / 12 } : null,
        p.estimated ? { label: 'Less UIF', value: -e.uif / 12 } : null,
        p.estimated && num(v.employeeRetirement) ? { label: 'Less your retirement contribution', value: -num(v.employeeRetirement) } : null,
        p.estimated && num(v.medicalOwn) ? { label: 'Less your medical aid', value: -num(v.medicalOwn) } : null,
        { label: 'Take-home', value: f.takeHome, total: true },
        num(v.benefitSaves) ? { label: 'Costs the benefits save', value: num(v.benefitSaves) } : null,
        num(v.commute) ? { label: 'Less getting to work', value: -num(v.commute) } : null,
        num(v.livingChange) ? { label: num(v.livingChange) > 0 ? 'Less higher living costs' : 'Plus lower living costs', value: -num(v.livingChange) } : null,
        { label: 'Left for the household', value: f.household, total: true },
      ]),
    ]),
    assumed(FIELDS, d),
    levers(v, p),
  ];
  if (shows('advanced')) out.push(advanced(v, p));
  if (shows('learn')) out.push(learn(v, p));
  return out;
}

function levers(v, p) {
  const tries = [];
  const more = project({ ...v, ...(num(v.takeHome) ? { takeHome: num(v.takeHome) + 1500 } : { grossMonthly: num(v.grossMonthly) + 2000 }) }, 12);
  tries.push(`${num(v.takeHome) ? 'R1 500 more take-home' : 'Negotiating R2 000 more salary'}: ${rand(more.first.household - p.first.household)} more a month for the household${num(v.takeHome) ? '' : ' - tax takes part of every extra rand'}.`);
  const up = project({ ...v, raisePct: num(v.raisePct) + 2 }, 120);
  tries.push(`Increases 2 points bigger each year: ${rand(up.rows[59].household - p.rows[59].household)} more a month by year 5.`);
  if (moveCash(v).cost > 0 && !num(v.moveAllowance)) tries.push('Asking the employer to pay the move: every rand they pay is a rand you do not have to save first, or earn back.');
  return el('div', { class: 'panel stack' }, [el('h2', { text: 'What would change it', style: { margin: 0 } }), el('ul', { style: { margin: 0 } }, tries.map((t) => el('li', { text: t })))]);
}

function advanced(v, p) {
  const years = [1, 3, 5, 10];
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Over the years', style: { margin: 0 } }),
    lineChart([
      { name: 'Take-home a month', points: p.rows.filter((r) => r.month % 3 === 1).map((r) => [r.month - 1, r.takeHome]) },
      { name: 'Left for the household a month', points: p.rows.filter((r) => r.month % 3 === 1).map((r) => [r.month - 1, r.household]), dashed: true },
    ], { label: 'Take-home and what is left for the household, month by month over ten years' }),
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, ['After', 'Salary a month', 'Take-home a month', 'Left for household, in all', 'In today’s money', 'Retirement saved'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
      el('tbody', {}, years.map((y) => { const r = p.rows[y * 12 - 1]; return el('tr', {}, [el('td', { text: `${y} year${y === 1 ? '' : 's'}` }), ...[r.gross, r.takeHome, r.cumHousehold, r.cumReal, r.retirement].map((x) => el('td', { class: 'num', text: rand(x) }))]); })),
    ])]),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `"In today’s money" takes off prices rising ${pct(num(v.escalatePct))} a year. Retirement saved is both contributions, growing ${pct(num(v.growthPct))} a year - illustrative.` }),
  ]);
}

function learn(v, p) {
  const e = estimatePay(v);
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    p.estimated ? step('1. Taxable income for the year', 'Pay + employer’s medical and retirement contributions − retirement contributions (up to 27.5%, at most R350 000)', `${rand(e.pay)} + ${rand(12 * (num(v.employerMedical) + num(v.employerRetirement)))} − ${rand(e.deduction)} = ${rand(e.taxable)}`, 'The employer’s contributions count as taxable benefits; retirement contributions are then deducted.') : null,
    p.estimated ? step('2. Tax', 'SARS bands: 18%, 26%, 31%, 36%, 39%, 41%, 45% - less the rebate (R17 820 under 65) and medical credits', `${rand(bandTax(e.taxable))} − rebates and credits = ${rand(e.tax)} a year (${rand(e.tax / 12)} a month). Each extra rand is taxed at ${Math.round(e.marginal * 100)}%.`, SARS.source) : null,
    p.estimated ? step('3. Take-home', 'Pay − tax − UIF (1% up to R177.12 a month) − your retirement and medical aid', `${rand(e.monthly)} a month`) : step('Take-home', 'The payslip figure, growing with each increase', `${rand(num(v.takeHome))} a month now`, 'In real life tax takes a slightly bigger share of each increase; the SARS estimate (leave take-home empty) shows that.'),
    step('Increases', `Pay after an increase = pay × (1 + ${pct(num(v.raisePct))}); the first after ${num(v.raiseAfter)} months, then yearly`, `Year 5: ${rand(p.rows[59].gross)} a month before tax`, 'An assumption, not a promise - check what the company has really given in past years.'),
    step('Left for the household', 'Take-home + costs saved by benefits − travel − living costs that change (those rise with prices)', `${rand(p.first.household)} a month now`),
    step('Today’s money', 'Amount in month m ÷ (1 + inflation)^(m ÷ 12)', `10 years in all: ${rand(p.rows[119].cumHousehold)}, or ${rand(p.rows[119].cumReal)} in today’s money`),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'The tax tables are held at 2026/27. SARS usually raises the bands with inflation, so later take-home is a little understated.',
      'A car allowance or company car is taxed in its own way; here allowances are taxed like salary, and the company car is a value you enter.',
      'Bonuses are spread evenly over the year. Leave, training, and the security of the job are not money - note them under "Worth weighing".',
      'Your own figures - from a payslip, an offer letter, a quote - always beat these estimates.',
    ].map((t) => el('li', { text: t }))),
  ]);
}

/* ------------------------------------------------------------- compare */

const view = { baseId: null, years: 5 };

function compareScreen(hub, param) {
  const ids = param.split(',').filter(Boolean);
  const res = hub.use(`compare:${param}`, async () => (await Promise.all(ids.map((id) => col(hub).get(id)))).filter((r) => r && r.kind === KIND));
  if (res.loading) return loading();
  if (res.error) return failure(res.error);
  const recs = res.data;
  if (recs.length < 2) return el('p', { class: 'panel', text: 'Tick two or more saved jobs to compare.' });
  const H = view.years * 12;
  const vals = (r) => ({ ...DEFAULTS, ...r.values });
  // Compared with the one chosen - at first the one saved earliest, usually the job you have.
  const base = recs.find((r) => r.id === view.baseId) ?? [...recs].sort((x, y) => String(x.savedAt).localeCompare(String(y.savedAt)))[0];
  const ordered = [base, ...recs.filter((r) => r !== base)];
  const items = ordered.map((r) => {
    const p = project(vals(r), Math.max(H, 12));
    const vs = r === base ? null : versus(vals(r), vals(base), H);
    return { title: r.title, rec: r, p, vs, mv: moveCash(vals(r)), out: { p, vs, mv: moveCash(vals(r)) } };
  }).filter((x) => !x.p.missing);
  const chips = (label, list, key) => el('div', { class: 'stack', style: { gap: 'var(--space-1)' } }, [
    el('strong', { text: label }),
    el('div', { class: 'chipset' }, list.map((o) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(o.on ?? view[key] === o.value), 'data-field': `${key}:${o.value}`, text: o.label,
      on: { click: () => { view[key] = o.value; hub.render(); } },
    }))),
  ]);
  const when = (m) => (m == null ? 'not in 30 years' : m === 0 ? 'straight away' : `after ${months(m)}`);
  const others = items.slice(1);

  return el('section', { class: 'stack', 'aria-labelledby': 'cmp-title' }, [
    el('h1', { id: 'cmp-title', text: 'Which job leaves us better off?', style: { margin: 0 } }),
    el('div', { class: 'panel stack' }, [
      chips('Compared with', recs.map((r) => ({ value: r.id, label: r.title, on: r === base })), 'baseId'),
      chips('Over', [1, 3, 5, 10, 15].map((y) => ({ value: y, label: `${y} year${y === 1 ? '' : 's'}` })), 'years'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'In plain words', style: { margin: 0 } }),
      ...others.map(({ title, vs, mv }) => el('div', { class: 'stack', style: { gap: 'var(--space-1)' } }, [
        el('strong', { text: title }),
        el('p', { style: { margin: 0 }, text: `Over ${months(H)}, it leaves the household ${rand(Math.abs(vs.ahead))} ${vs.ahead >= 0 ? 'more' : 'less'} than ${base.title}${vs.upfront > 0 ? `, after ${rand(vs.upfront)} of moving costs${vs.lost ? ' and time without pay' : ''}` : vs.upfront < 0 ? `, counting the ${rand(-vs.upfront)} it saves on moving` : ''} - ${rand(Math.abs(vs.real))} ${vs.real >= 0 ? 'more' : 'less'} in today’s money.` }),
        el('p', { style: { margin: 0 }, text: `Each month now: ${rand(Math.abs(vs.monthlyNow))} ${vs.monthlyNow >= 0 ? 'more' : 'less'}. ${vs.salaryAhead != null && vs.salaryAhead > 1 ? `Its salary overtakes ${when(vs.salaryAhead)}; the running total ${vs.totalAhead ? `catches up ${when(vs.totalAhead)}` : 'does not catch up within 30 years'}.` : vs.totalAhead ? `It is ahead in total ${when(vs.totalAhead)}.` : 'It does not get ahead within 30 years with these assumptions.'}` }),
        mv.needed > 0 ? el('p', { style: { margin: 0 }, text: `To take it: ${rand(mv.needed)} in cash before moving. ${mv.short <= 0 ? 'Already saved.' : mv.monthsToSave == null ? `${rand(mv.short)} is missing, with nothing to put aside each month - the job may be better and still out of reach without help.` : `${rand(mv.short)} is missing: about ${months(mv.monthsToSave)} of saving first.`}` }) : null,
        vs.upfront > 0 ? el('p', { style: { margin: 0 }, text: vs.payback == null ? `The move is not earned back: ${vs.monthlyNow <= 0 ? 'this job leaves no more each month than staying' : 'the extra each month never covers it'} under these assumptions.` : `The move pays for itself ${when(vs.payback)} - earning it back is not the same as having the cash before you go.` }) : null,
      ])),
    ]),
    compareTable(items, [
      { label: 'Take-home a month', get: (o) => o.p.first.takeHome, lower: false },
      { label: 'Total package a month', get: (o) => o.p.first.package, lower: false },
      { key: 1, label: 'Left for the household a month', get: (o) => o.p.first.household, lower: false },
      { label: 'Cash needed before moving', get: (o) => o.mv.needed, lower: true },
      { label: 'Months of saving first', get: (o) => (o.mv.needed > 0 ? (o.mv.monthsToSave == null ? 'cannot yet' : String(o.mv.monthsToSave)) : '-') },
      { key: 1, label: `Left for the household over ${months(H)}`, get: (o) => o.p.rows[H - 1].cumHousehold, lower: false },
      { label: 'Ahead after moving costs', get: (o) => (o.vs ? o.vs.ahead : 0), lower: false, total: true },
      { label: 'In today’s money', get: (o) => (o.vs ? o.vs.real : 0), lower: false },
      { label: 'Retirement saved', get: (o) => o.p.rows[H - 1].retirement, lower: false },
      { label: 'Move earned back', get: (o) => (o.vs ? (o.vs.upfront ? when(o.vs.payback) : 'no move') : '-') },
    ]),
    shows('advanced') ? el('div', { class: 'panel stack' }, [
      el('h2', { text: `Ahead of ${base.title}, over time`, style: { margin: 0 } }),
      lineChart(others.map(({ title, vs }) => ({ name: title, points: [[0, -vs.upfront], ...vs.diff.filter((x) => x.month % 3 === 0).map((x) => [x.month, x.ahead])] })), { label: 'How far ahead or behind each job is, month by month' }),
      el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
        el('thead', {}, [el('tr', {}, ['', ...[1, 3, 5, 10].map((y) => `${y} year${y === 1 ? '' : 's'}`)].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
        el('tbody', {}, others.map(({ title, rec }) => el('tr', {}, [el('td', { text: title }), ...versus(vals(rec), vals(base), 120).milestones.map((x) => el('td', { class: `num ${x.ahead >= 0 ? 'fin-better' : 'fin-worse'}`, text: rand(x.ahead) }))]))),
      ])]),
      el('h3', { text: 'If the increases do not go as assumed', style: { margin: 0 } }),
      el('ul', { style: { margin: 0 } }, others.map(({ title, rec }) => {
        const low = versus({ ...vals(rec), raisePct: num(vals(rec).raisePct) - 2 }, vals(base), H);
        const high = versus(vals(rec), { ...vals(base), raisePct: num(vals(base).raisePct) + 2 }, H);
        return el('li', { text: `${title}: with its increases 2 points smaller, ${rand(low.ahead)}; with ${base.title}’s 2 points bigger, ${rand(high.ahead)}.` });
      })),
      items.some((x) => num(x.rec.values.bonusPerformance)) ? el('p', { class: 'small muted', style: { margin: 0 }, text: `Performance bonuses are left out above. ${others.map(({ title, vs }) => `${title}: ${rand(vs.perf)} ${vs.perf >= 0 ? 'more' : 'less'} over ${months(H)} if all were paid`).join('; ')}.` }) : null,
    ]) : null,
    items.some((x) => x.rec.values.notes) ? el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Worth weighing - not money', style: { margin: 0 } }),
      ...items.filter((x) => x.rec.values.notes).map((x) => el('p', { style: { margin: 0 } }, [el('strong', { text: `${x.title}: ` }), x.rec.values.notes])),
    ]) : null,
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Figures follow what was saved. Increases, bonuses and costs ahead are assumptions; take-home from a payslip is firmer than a SARS estimate.' }),
  ]);
}
