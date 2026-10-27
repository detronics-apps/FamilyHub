// The money plan (D-070): every goal on one timeline - trips from Holidays, saved
// cars and homes, the children's costs, savings goals - against what the family
// can put aside each month. It says what to put aside, and where it does not fit.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { loading, failure, saveRecord } from '../kit.js';
import { levelBar, shows, stat, step, lineChart, chartPanel, crossing, whenLabel, rand, pct, months } from '../finance/pod.js';
import { carCost, homeCost, bond, CAR_DEFAULTS, HOME_DEFAULTS } from '../finance/maths.js';
import { normaliseMonth, monthSummary, monthId, normaliseGoal as financeGoal } from '../finance/logic.js';
import { normaliseTrip, budgetSummary } from '../holidays/logic.js';
import { normalisePlan as childPlan, schedule } from '../children/logic.js';
import { OFFER_DEFAULTS, versus, moveCash } from '../jobs/logic.js';
import { normalisePlan, simulate, extraToFit, postponeToFit, monthAt, monthsTo, freeEachMonth } from './logic.js';

const col = (hub) => hub.data.collection('plan', { summary: () => ({ title: 'Money plan' }), prefix: 'mpl' });
const ID = 'main';
const ui = { job: null };

export function render(hub) {
  const r = hub.use('plan', async () => normalisePlan((await col(hub).get(ID)) ?? {}));
  const found = hub.use('found', () => gather(hub));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  return planScreen(hub, r.data, found.data ?? null);
}

const save = (hub, plan) => saveRecord(hub, col(hub), { ...plan, id: ID });
const num = (v) => Number(v) || 0;
const monthName = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/* ------------------------------------------------- what other apps know */

/** Everything the other Finance apps and Holidays could add to the plan, ready to bring in. */
async function gather(hub) {
  const today = hub.today();
  const read = async (app, name) => {
    if (!hub.data.installed(app)) return [];
    const c = hub.data.of(app, name);
    const { items } = await c.list({ limit: 1000 });
    return (await Promise.all(items.map((s) => c.get(s.id)))).filter(Boolean);
  };
  const out = { budget: null, offers: [], candidates: [] };
  const add = (app, label, g) => out.candidates.push({ ...g, source: { app, id: g.id, label } });

  try {
    const m = today.slice(0, 7);
    const rec = hub.data.installed('finance') ? await hub.data.of('finance', 'months').get(monthId(m)) : null;
    if (rec) { const s = monthSummary(normaliseMonth(rec, m)); if (s.income || s.planned) out.budget = s; }
  } catch { /* no budget yet */ }

  for (const t of (await read('holidays', 'trips').catch(() => [])).map(normaliseTrip)) {
    if (!t.startDay || t.startDay < today) continue;
    const b = budgetSummary(t);
    const amount = Math.max(num(t.budget), b.planned) - b.paid;
    if (amount > 0) add('holidays', 'Holidays', { id: `trip-${t.id}`, title: t.title, payments: [{ month: t.startDay.slice(0, 7), amount: amount * 1.1 }], note: `Budget left to pay, plus 10% for the unexpected` });
  }
  for (const g of (await read('finance', 'goals').catch(() => [])).map(financeGoal)) {
    if (g.kind !== 'saving' || g.target <= g.current) continue;
    add('finance', 'Budget and goals', { id: `goal-${g.id}`, title: g.title, saved: g.current, payments: [{ month: (g.targetDay ?? monthAt(today, 12)).slice(0, 7), amount: g.target }] });
  }
  for (const r of (await read('cars', 'saved').catch(() => [])).filter((x) => x.kind === 'car')) {
    const c = carCost({ ...CAR_DEFAULTS, ...r.values });
    if (c.total == null) continue;
    add('cars', 'Cars', { id: `car-${r.id}`, title: r.title, payments: [{ month: monthAt(today, 6), amount: c.upfront }], monthly: [{ from: monthAt(today, 7), amount: c.instalment + c.runningFirstMonth }], note: 'Cash to buy it, then the instalment and running costs each month. If it replaces a car you have, take that car’s costs off.' });
  }
  for (const r of await read('homes', 'saved').catch(() => [])) {
    const v = { ...HOME_DEFAULTS, ...r.values };
    if (r.kind === 'home') {
      const c = homeCost(v);
      if (c.total == null) continue;
      add('homes', 'Homes', { id: `home-${r.id}`, title: r.title, payments: [{ month: monthAt(today, 6), amount: c.upfront }], monthly: [{ from: monthAt(today, 7), amount: c.monthNow }], note: 'Cash to move in, then the monthly cost of living there. If it replaces your rent or bond now, take that off.' });
    } else if (r.kind === 'bond') {
      const b = bond(v);
      if (b.instalment == null) continue;
      add('homes', 'Homes', { id: `bond-${r.id}`, title: r.title, payments: [{ month: monthAt(today, 6), amount: b.cashFirst }], monthly: [{ from: monthAt(today, 7), amount: b.instalment }], note: 'Cash needed first, then the bond each month.' });
    }
  }
  if (hub.data.installed('children') && hub.people) {
    const kidsCol = hub.data.of('children', 'plans');
    const settings = await kidsCol.get('settings').catch(() => null);
    // The same children as Children's future: marked as a child, or under 25 - with the starting list if theirs was never changed.
    for (const p of hub.people.list().filter((x) => x.born && (x.role === 'child' || monthsTo(today, x.born.slice(0, 7)) > -300))) {
      const rec = await kidsCol.get(`kid_${p.id}`).catch(() => null);
      const s = schedule(p, childPlan(rec ?? {}).items, today, { savingsPct: settings?.savingsPct ?? 6 });
      const ahead = s.payments.filter((x) => !x.budget);
      // School fees and the like change the monthly budget, year by year, from what is paid now.
      const steps = []; let level = s.nowMonthly;
      for (const y of [...new Set(s.payments.filter((x) => x.budget).map((x) => x.year))].sort()) {
        const next = s.payments.filter((x) => x.budget && x.year === y).reduce((t, x) => t + x.amount, 0) / 12;
        steps.push({ from: `${y}-01`, amount: next - level }); level = next;
      }
      if (level > 0) steps.push({ from: `${Math.max(...s.payments.map((x) => x.year)) + 1}-01`, amount: -level });
      if (ahead.length || steps.length) add('children', 'Children’s future', { id: `kid-${p.id}`, title: `${p.name}: growing up`, must: true, payments: ahead.map((x) => ({ month: monthAt(today, x.months), amount: x.amount })), monthly: steps.filter((x) => monthsTo(today, x.from) > 0), note: 'Save-ahead costs as payments; school fees and the like as changes to the monthly budget.' });
    }
  }
  const offers = (await read('jobs', 'saved').catch(() => [])).filter((x) => x.kind === 'offer').sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  out.offers = offers;
  return out;
}

/* ---------------------------------------------------------------- screen */

function planScreen(hub, plan, found) {
  const today = hub.today();
  const set = (patch) => save(hub, { ...plan, ...patch });
  const setGoal = (id, patch) => set({ goals: plan.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  // The job what-if: less or more each month, and a move to pay for.
  const offers = found?.offers ?? [];
  const base = offers[0];
  const offer = offers.find((o) => o.id === ui.job && o !== base);
  let opts = {};
  let vs = null;
  if (offer && base) {
    vs = versus({ ...OFFER_DEFAULTS, ...offer.values }, { ...OFFER_DEFAULTS, ...base.values }, 360);
    const mv = moveCash(offer.values);
    opts = {
      jobDelta: (m) => vs.diff[m - 1]?.monthly ?? vs.diff.at(-1).monthly,
      more: mv.needed > 0 ? [{ id: 'job-move', title: `Moving for ${offer.title}`, must: true, saved: num(offer.values.savedForMove), payments: [{ month: monthAt(today, num(offer.values.monthsToMove) || 3), amount: mv.needed }] }] : [],
    };
  }
  const s = simulate(plan, today, opts);
  const without = vs ? simulate(plan, today) : null;
  const ready = num(plan.income) > 0;

  return el('section', { class: 'stack', 'aria-labelledby': 'plan-title' }, [
    el('h1', { id: 'plan-title', text: 'Can we do all of it?', style: { margin: 0 } }),
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Every goal on one timeline - trips, a car, a home, the children - against what you can put aside each month. Not a spending record: look at it once a month.' }),
    levelBar(() => hub.render()),
    moneyPanel(hub, plan, set, found),
    ready ? results(plan, s, today, opts, vs, without, offer) : el('p', { class: 'panel muted', text: 'Fill in the money coming in and the monthly commitments to see whether the plan fits.' }),
    ready ? planStory(s, today) : null,
    goalsPanel(hub, plan, s, set, setGoal, today),
    found ? bringIn(plan, found, set) : el('p', { class: 'small muted', text: 'Looking for goals in the other apps…' }),
    offers.length > 1 ? jobPanel(hub, offers, base) : null,
    ready && shows('advanced') ? advanced(s, today) : null,
    shows('learn') ? learn(plan) : null,
  ]);
}

function field(id, label, value, onChange, { hint, tag, type = 'number', unit = 'R' } = {}) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id }, [label, tag ? ' ' : null, tag ? el('span', { class: 'fin-tag', text: tag }) : null]),
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
      unit === 'R' ? el('span', { class: 'muted', text: 'R' }) : null,
      el('input', { class: 'input', id, type, step: 'any', min: type === 'number' ? '0' : null, value: value ?? '', 'data-field': `in:${id}`, style: { maxWidth: '200px' }, on: { change: (e) => onChange(e.target.value === '' ? null : type === 'number' ? Number(e.target.value) : e.target.value) } }),
      unit && unit !== 'R' ? el('span', { class: 'small muted', text: unit }) : null,
    ]),
    hint ? el('div', { class: 'field__hint', text: hint }) : null,
  ]);
}

function moneyPanel(hub, plan, set, found) {
  const b = found?.budget;
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Each month', style: { margin: 0 } }),
    b ? el('div', { class: 'row' }, [
      el('p', { class: 'small', style: { margin: 0, flex: '1 1 240px' }, text: `This month’s budget has ${rand(b.income)} coming in and ${rand(b.planned)} planned.` }),
      el('button', { class: 'btn btn-small', type: 'button', text: 'Use these', 'data-field': 'use-budget', title: 'Fill in the money coming in and the commitments from this month’s budget', on: { click: () => set({ ...(b.income ? { income: b.income } : {}), ...(b.planned ? { commitments: b.planned } : {}) }) } }),
    ]) : null,
    field('income', 'Money coming in, after tax', plan.income, (v) => set({ income: v })),
    field('commitments', 'Monthly commitments', plan.commitments, (v) => set({ commitments: v }), { hint: 'Rent or bond, car, school fees, insurance, debt repayments, groceries and the other things paid every month.' }),
    field('keepBack', 'Kept back for surprises', plan.keepBack, (v) => set({ keepBack: v }), { hint: 'A buffer that is not given to any goal.' }),
    el('p', { class: 'small', style: { margin: 0 }, text: `That leaves ${rand(freeEachMonth(plan))} a month to put towards goals.` }),
    shows('advanced') ? el('fieldset', { class: 'stack fin-group' }, [
      el('legend', { text: 'Over the years, and the emergency fund' }),
      field('incomeRisePct', 'Income rises by', plan.incomeRisePct, (v) => set({ incomeRisePct: v }), { unit: '% a year', tag: 'Assumption', hint: 'Once a year. Inflation (CPI, Stats SA September 2026) is 4.5%.' }),
      field('commitmentsRisePct', 'Commitments rise by', plan.commitmentsRisePct, (v) => set({ commitmentsRisePct: v }), { unit: '% a year', tag: 'Assumption' }),
      field('emergencyMonths', 'Emergency fund: months of commitments', plan.emergencyMonths, (v) => set({ emergencyMonths: v }), { unit: 'months', tag: 'Assumption', hint: 'Three to six months is a common guide. Shown as a must-have goal.' }),
      field('emergencySaved', 'Emergency fund saved already', plan.emergencySaved, (v) => set({ emergencySaved: v })),
      field('emergencyBy', 'Emergency fund by', plan.emergencyBy, (v) => set({ emergencyBy: v }), { type: 'month', unit: null, hint: 'Left empty: a year from now.' }),
      field('savingsPct', 'Savings grow by', plan.savingsPct, (v) => set({ savingsPct: v }), { unit: '% a year', tag: 'Illustrative' }),
    ]) : null,
  ]);
}

function results(plan, s, today, opts, vs, without, offer) {
  const when = (m) => monthName(monthAt(today, m));
  const lines = [];
  if (s.deficitMonths) lines.push(`From ${when(s.deficitFrom)}, for ${months(s.deficitMonths)} in all, the commitments (with the goals’ monthly changes, like school fees) are more than the money coming in - before anything is put aside.`);
  if (s.fits) {
    lines.push(`Everything on the plan fits. ${s.neededNow <= s.availNow + 0.5 ? `Put aside ${rand(s.neededNow)} a month of the ${rand(s.availNow)} free - ${rand(s.availNow - s.neededNow)} to spare.` : 'It fits if the money goes to the soonest goal first, then the next.'}`);
  } else {
    lines.push(`Not everything fits: ${rand(s.shortTotal)} short in all.`);
  }
  const musts = simulate(plan, today, { ...opts, only: (g) => g.must });
  if (!s.fits) lines.push(musts.fits ? 'The must-haves alone fit - the want-to-haves are where to give.' : 'Even the must-haves alone do not fit as they stand.');
  const extra = s.fits ? 0 : extraToFit(plan, today, opts);
  return el('div', { class: 'stack', 'aria-live': 'polite' }, [
    el('div', { class: 'stats' }, [
      stat(rand(s.availNow), 'free each month for goals', 'r-free'),
      stat(rand(s.neededNow), 'needed each month now', 'r-needed'),
      stat(s.fits ? 'It fits' : rand(s.shortTotal), s.fits ? 'every goal funded in time' : 'short, across the goals below', 'r-fits'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'What it means', style: { margin: 0 } }),
      ...lines.map((t) => el('p', { style: { margin: 0 }, text: t })),
      ...s.short.map((g) => {
        const k = postponeToFit(plan, today, g.id, opts);
        return el('p', { style: { margin: 0 } }, [
          el('strong', { text: `${g.title}: ` }),
          `${rand(g.short)} short by ${when(g.firstShort)}. `,
          k ? `Moving it ${months(k)} later would fit. ` : '',
          g.total - g.short >= 1 ? `Or plan for ${rand(g.total - g.short)} instead of ${rand(g.total)}.` : 'Nothing is left over for it as the plan stands.',
        ]);
      }),
      !s.fits ? el('p', { style: { margin: 0 }, text: extra == null ? 'Putting more aside each month would not be enough on its own: something has to move or shrink.' : `Or put aside ${rand(extra)} more a month, and everything fits.` }) : null,
      vs && offer ? el('p', { class: 'panel panel--soft', style: { margin: 0 }, text: `With ${offer.title}: ${rand(Math.abs(vs.monthlyNow))} ${vs.monthlyNow >= 0 ? 'more' : 'less'} each month${opts.more?.length ? `, and ${rand(opts.more[0].payments[0].amount)} to move` : ''}. ${without.fits && !s.fits ? 'The plan fits now, but would not with this job.' : !without.fits && s.fits ? 'The plan does not fit now, but would with this job.' : s.shortTotal > without.shortTotal ? `${rand(s.shortTotal - without.shortTotal)} more short than without it.` : s.shortTotal < without.shortTotal ? `${rand(without.shortTotal - s.shortTotal)} less short than without it.` : 'The plan fits either way.'}` }) : null,
    ]),
  ]);
}

function goalsPanel(hub, plan, s, set, setGoal, today) {
  const status = new Map(s.goals.map((g) => [g.id, g]));
  const draft = { title: el('input', { class: 'input', id: 'g-title', placeholder: 'e.g. New roof', 'data-field': 'g-title' }), amount: el('input', { class: 'input', id: 'g-amount', type: 'number', min: '0', style: { maxWidth: '150px' } }), month: el('input', { class: 'input', id: 'g-month', type: 'month', value: monthAt(today, 12), style: { maxWidth: '180px' } }) };
  let must = false;
  const sorted = [...plan.goals].sort((a, b) => String(a.payments[0]?.month ?? '9999').localeCompare(String(b.payments[0]?.month ?? '9999')));
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Goals, soonest first', style: { margin: 0 } }),
    status.get('emergency') ? goalRow({ id: 'emergency', title: 'Emergency fund', must: true, payments: [{ month: plan.emergencyBy ?? monthAt(today, 12), amount: num(plan.emergencyMonths) * num(plan.commitments) }], saved: num(plan.emergencySaved), monthly: [], on: true, fixed: true }, status, today) : null,
    ...sorted.map((g) => goalRow(g, status, today, setGoal, async () => {
      if (await confirmAction({ title: `Take "${g.title}" off the plan?`, text: 'It is removed from the plan only - nothing changes in the app it came from.', confirmLabel: 'Remove' })) set({ goals: plan.goals.filter((x) => x.id !== g.id) });
    })),
    plan.goals.length ? null : el('p', { class: 'muted', style: { margin: 0 }, text: 'No goals yet. Add one below, or bring them in from the other apps.' }),
    el('h3', { text: 'Add a goal', style: { margin: 0 } }),
    el('div', { class: 'row' }, [
      el('div', { class: 'field', style: { flex: '1 1 200px' } }, [el('label', { class: 'field__label', for: 'g-title', text: 'What' }), draft.title]),
      el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'g-amount', text: 'How much, R' }), draft.amount]),
      el('div', { class: 'field' }, [el('label', { class: 'field__label', for: 'g-month', text: 'By' }), draft.month]),
    ]),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'How important' }, [[false, 'Want to'], [true, 'Must']].map(([v, l]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(v === must), text: l,
      on: { click: (e) => { must = v; for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); } },
    }))),
    el('div', {}, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Add', 'data-field': 'g-add', on: { click: () => {
      if (!draft.title.value.trim() || !(Number(draft.amount.value) > 0) || !draft.month.value) { (draft.title.value.trim() ? draft.amount : draft.title).focus(); return; }
      set({ goals: [...plan.goals, { id: `g${Date.now().toString(36)}`, title: draft.title.value.trim(), must, payments: [{ month: draft.month.value, amount: Number(draft.amount.value) }], monthly: [], saved: 0, on: true }] });
    } } })]),
  ]);
}

function goalRow(g, status, today, setGoal, remove) {
  const st = status.get(g.id);
  const single = g.payments.length === 1;
  const total = g.payments.reduce((s, p) => s + p.amount, 0);
  const span = g.payments.length ? (single ? monthName(g.payments[0].month) : `${monthName(g.payments[0].month)} to ${monthName(g.payments.at(-1).month)}`) : 'no payments';
  const monthlyNote = g.monthly.length ? `then ${g.monthly.length === 1 ? `${rand(g.monthly[0].amount)} a month from ${monthName(g.monthly[0].from)}` : 'changes to the monthly budget over the years'}` : null;
  return el('div', { class: 'stack', style: { gap: 'var(--space-1)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' }, 'data-field': `goal:${g.id}` }, [
    el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'baseline' } }, [
      g.fixed ? null : el('input', { type: 'checkbox', checked: g.on, 'aria-label': `Count ${g.title}`, on: { change: (e) => setGoal(g.id, { on: e.target.checked }) } }),
      el('strong', { text: g.title, style: { flex: '1 1 auto' } }),
      el('span', { class: `small ${!g.on ? 'muted' : st?.short >= 1 ? 'fin-worse' : 'fin-better'}`, text: !g.on ? 'not counted' : st?.short >= 1 ? `short ${rand(st.short)}` : 'on track' }),
    ]),
    el('div', { class: 'small muted', text: [
      `${rand(total)}${single ? ` by ${span}` : ` in ${g.payments.length} payments, ${span}`}`,
      monthlyNote, g.saved ? `${rand(g.saved)} saved` : null,
      g.on && st && st.alone ? `${rand(st.alone)} a month on its own` : null,
      g.must ? 'must' : 'want to', g.source?.label ? `from ${g.source.label}` : null,
    ].filter(Boolean).join(' · ') }),
    g.note ? el('div', { class: 'small muted', text: g.note }) : null,
    !g.fixed && shows('advanced') && setGoal ? el('div', { class: 'row', style: { gap: 'var(--space-2)', alignItems: 'center' } }, [
      single ? el('span', { class: 'small muted', text: 'R' }) : null,
      single ? el('input', { class: 'input', type: 'number', min: '0', value: g.payments[0].amount, 'aria-label': `Amount: ${g.title}`, style: { maxWidth: '130px' }, on: { change: (e) => setGoal(g.id, { payments: [{ ...g.payments[0], amount: Number(e.target.value) || 0 }] }) } }) : null,
      single ? el('input', { class: 'input', type: 'month', value: g.payments[0].month, 'aria-label': `By: ${g.title}`, style: { maxWidth: '170px' }, on: { change: (e) => e.target.value && setGoal(g.id, { payments: [{ ...g.payments[0], month: e.target.value }] }) } }) : null,
      el('span', { class: 'small muted', text: 'Saved R' }),
      el('input', { class: 'input', type: 'number', min: '0', value: g.saved || '', 'aria-label': `Saved already: ${g.title}`, style: { maxWidth: '120px' }, on: { change: (e) => setGoal(g.id, { saved: Number(e.target.value) || 0 }) } }),
      el('div', { class: 'chipset', role: 'group', 'aria-label': `How important: ${g.title}` }, [[false, 'Want to'], [true, 'Must']].map(([v, l]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(v === g.must), text: l, on: { click: () => setGoal(g.id, { must: v }) },
      }))),
    ]) : null,
    remove ? el('div', {}, [el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${g.title}`, on: { click: remove } })]) : null,
  ]);
}

function bringIn(plan, found, set) {
  const have = new Map(plan.goals.filter((g) => g.source).map((g) => [g.source.id, g]));
  const list = found.candidates;
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Bring in from the other apps', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'Trips with a budget, savings goals, saved cars and homes, and the children’s costs. Brought in once, then yours to change here; Update takes the latest from the app again.' }),
    list.length ? el('ul', { class: 'list' }, list.map((c) => {
      const there = have.get(c.id);
      return el('li', {}, [
        el('div', { class: 'list__main' }, [el('strong', { text: c.title }), el('div', { class: 'small muted', text: [c.source.label, c.payments.reduce((s, p) => s + p.amount, 0) >= 1 ? `${rand(c.payments.reduce((s, p) => s + p.amount, 0))} from ${monthName(c.payments[0].month)}` : 'no cash up front', c.monthly?.length ? 'changes the monthly budget' : null].filter(Boolean).join(' · ') })]),
        el('button', { class: `btn btn-small${there ? '' : ' btn-primary'}`, type: 'button', text: there ? 'Update' : 'Add', 'data-field': `bring:${c.id}`,
          on: { click: () => {
            const g = { ...c, id: there?.id ?? `g${Date.now().toString(36)}`, on: true, saved: there?.saved ?? c.saved ?? 0, must: there?.must ?? c.must ?? false, payments: there && c.payments.length === 1 && there.payments.length === 1 ? [{ ...c.payments[0], month: there.payments[0].month }] : c.payments, monthly: c.monthly ?? [] };
            set({ goals: there ? plan.goals.map((x) => (x === there ? g : x)) : [...plan.goals, g] });
          } } }),
      ]);
    })) : el('p', { class: 'muted', style: { margin: 0 }, text: 'Nothing to bring in yet. Trips with a budget and a date, saving goals with a target, saved cars and homes, and children’s lists will show here.' }),
  ]);
}

function jobPanel(hub, offers, base) {
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'What if we take a new job?', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: `From Job offers, against ${base.title}: the change in money each month, and the cash to move, put into the plan above.` }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Job' }, [{ id: null, title: 'No change' }, ...offers.slice(1)].map((o) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String((ui.job ?? null) === o.id), 'data-field': `job:${o.id ?? 'none'}`, text: o.title,
      on: { click: () => { ui.job = o.id; hub.render(); } },
    }))),
  ]);
}

/** Money free each month against what the goals need - and where it first falls short. */
function planStory(s, today) {
  const pts = s.months.filter((x) => x.m % 3 === 1 || x.m === 1);
  const firstShort = s.short.length ? Math.min(...s.short.map((g) => g.firstShort)) : null;
  return chartPanel('Free against needed, month by month', lineChart([
    { name: 'Free each month', points: pts.map((x) => [x.m, x.avail]) },
    { name: 'Needed each month', points: pts.map((x) => [x.m, x.needed]), dashed: true },
  ], { label: 'Money free each month against what the goals need',
    marks: [firstShort != null ? { x: firstShort, label: `First goal short: ${monthName(monthAt(today, firstShort))}` } : null,
      s.deficitFrom != null ? { x: s.deficitFrom, label: 'Commitments outgrow income' } : null],
    story: 'Where the dashed line is above, the goals need more than is free that month - money put aside earlier, a goal moving, or a goal shrinking has to cover it.' }));
}

function advanced(s, today) {
  const pts = s.months.filter((x) => x.m % 3 === 1 || x.m === 1);
  const years = new Map();
  for (const x of s.months) {
    const y = monthAt(today, x.m).slice(0, 4);
    const r = years.get(y) ?? { y, due: 0, short: 0, avail: 0, n: 0 };
    r.due += x.due; r.short += x.short; r.avail += x.avail; r.n += 1;
    years.set(y, r);
  }
  return el('div', { class: 'panel stack' }, [
    el('h2', { text: 'Over time', style: { margin: 0 } }),
    el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, ['Year', 'Goals due', 'Short', 'Free a month'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
      el('tbody', {}, [...years.values()].filter((r) => r.due || r.short).map((r) => el('tr', { class: r.short >= 1 ? 'fin-overlap' : null }, [
        el('td', { text: r.y }), el('td', { class: 'num', text: rand(r.due) }), el('td', { class: `num ${r.short >= 1 ? 'fin-worse' : ''}`, text: r.short >= 1 ? rand(r.short) : '' }), el('td', { class: 'num', text: rand(r.avail / r.n) }),
      ]))),
    ])]),
  ]);
}

function learn(plan) {
  return el('div', { class: 'panel stack fin-learn' }, [
    el('h2', { text: 'How it is worked out', style: { margin: 0 } }),
    step('Free each month', 'Money coming in − commitments − kept back (income and commitments each rising once a year by their own rate), then each goal’s changes to the commitments from their month (a new bond, school fees starting, or ending)', `${rand(freeEachMonth(plan))} a month now; income rising ${pct(num(plan.incomeRisePct))}, commitments ${pct(num(plan.commitmentsRisePct))} a year`),
    step('Each goal on its own', 'S = (amount − saved, grown) × r ÷ ((1 + r)^n − 1)', `r = (1 + ${pct(num(plan.savingsPct))})^(1/12) − 1 a month; n = months until it is due`, 'What to put aside for that goal alone, from next month.'),
    step('All of them together', 'Each month the free money goes to the goal due soonest, then the next', null, 'If every goal is fully funded by its month, the plan fits. If not, the first goal that falls short - and by how much - is shown, with three ways out: more each month, later, or smaller.'),
    step('Saving is not spending', 'Goals are money put aside, not extra costs', null, 'Commitments are what is paid every month; goals are where the rest goes. Nothing is counted in both. When a goal is reached and paid, its saving stops.'),
    el('h3', { text: 'What this leaves out', style: { margin: 0 } }),
    el('ul', { class: 'small', style: { margin: 0 } }, [
      'Income and commitments rise steadily by the rates set; real raises and costs jump about. Look at the plan again each month.',
      'Savings growth is steady and before tax.',
      'Brought-in goals are copies: change the car or trip in its own app, then press Update here.',
    ].map((t) => el('li', { text: t }))),
  ]);
}
