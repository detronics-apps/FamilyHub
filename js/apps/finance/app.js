// Finance: this month's budget (planned against actual) and savings and debt
// goals. Every projection shows the assumptions it rests on.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import { linksControl, linksView } from '../../ui/links-editor.js';
import {
  monthId, monthOf, shiftMonth, normaliseMonth, monthSummary, copyMonth, addSpend, addLine, addIncome, removeFrom,
  normaliseGoal, goalSummary, projection, progress, recordAmount, goalTotals, GOAL_KINDS,
  plannedOf, startingSet, setLine, addItem, setItem, removeItem, perMeal, foodSettings, MEALS,
} from './logic.js';

const months = (hub) => hub.data.collection('months', { summary: (m) => ({ title: m.month, month: m.month }) });
const goals = (hub) => hub.data.collection('goals', { summary: goalSummary, text: (g) => g.title, prefix: 'gol' });
const money = (n) => (n == null ? '-' : Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

export function render(hub, route) {
  if (route.sub === 'goals') return goalsScreen(hub);
  if (route.sub === 'goal') return goalScreen(hub, route.rest[0]);
  if (route.sub === 'new-goal') return goalEdit(hub, null);
  if (route.sub === 'edit-goal') return goalEdit(hub, route.rest[0]);
  return budgetScreen(hub, route.rest[0] ?? null);
}

const nav = (hub, current) => tabs(hub, [{ screen: null, label: 'Budget' }, { screen: 'goals', label: 'Goals' }], current);
const loadMonth = (hub, month) => hub.use(`month:${month}`, async () => normaliseMonth((await months(hub).get(monthId(month))) ?? {}, month));

function budgetScreen(hub, param) {
  const month = param && /^\d{4}-\d{2}$/.test(param) ? param : monthOf(hub.today());
  const r = loadMonth(hub, month);
  const prev = loadMonth(hub, shiftMonth(month, -1));
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, null), loading()]);
  if (r.error) return el('section', { class: 'stack' }, [nav(hub, null), failure(r.error)]);
  const m = r.data;
  const s = monthSummary(m);
  const save = (next) => saveRecord(hub, months(hub), { ...next, id: monthId(month), month });
  const me = hub.people.current();

  const spendCat = el('select', { class: 'select', 'aria-label': 'Category', style: { width: 'auto' } }, [...m.lines.filter((l) => !l.off).map((l) => el('option', { value: l.category, text: l.category })), el('option', { value: 'Other', text: 'Other' })]);
  const spendAmount = el('input', { class: 'input', money: true, step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Amount spent', style: { maxWidth: '130px' }, 'data-field': 'spend-amount' });
  const spendNote = el('input', { class: 'input', placeholder: 'What for (optional)', 'aria-label': 'What it was for' });
  const doSpend = () => save(addSpend(m, { category: spendCat.value, amount: spendAmount.value, note: spendNote.value, day: hub.today(), who: me?.id ?? null }));
  const lineCat = el('input', { class: 'input', placeholder: 'Category, e.g. Groceries', 'aria-label': 'New category' });
  const linePlanned = el('input', { class: 'input', money: true, step: 'any', min: '0', placeholder: 'Planned', 'aria-label': 'Planned amount', style: { maxWidth: '130px' } });
  const incWhat = el('input', { class: 'input', placeholder: 'Income, e.g. Salary', 'aria-label': 'Income source' });
  const incAmount = el('input', { class: 'input', money: true, step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Income amount', style: { maxWidth: '130px' } });

  return el('section', { class: 'stack', 'aria-label': 'Budget' }, [
    nav(hub, null),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-small', href: hub.href('month', shiftMonth(month, -1)), text: '‹', 'aria-label': 'Previous month' }),
      el('strong', { text: monthName(month), style: { flex: '1 1 auto', textAlign: 'center' } }),
      el('a', { class: 'btn btn-small', href: hub.href('month', shiftMonth(month, 1)), text: '›', 'aria-label': 'Next month' }),
    ]),
    !m.lines.length ? el('div', { class: 'panel stack' }, [
      el('p', { style: { margin: 0 }, text: 'Start from the categories most families have, each broken into the things people forget - then untick what you do not have, rename, remove and add your own.' }),
      el('div', { class: 'row' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Starting set', 'data-field': 'starting-set', on: { click: () => save(startingSet(m)) } })]),
    ]) : null,
    !m.lines.length && prev.data?.lines.length ? el('button', { class: 'btn', type: 'button', text: `Reuse ${monthName(shiftMonth(month, -1))}`, title: `Start from ${monthName(shiftMonth(month, -1))}’s plan`, on: { click: () => save(copyMonth(prev.data, month)) } }) : null,
    el('div', { class: 'stats' }, [
      stat(money(s.income), 'income'),
      stat(money(s.planned), 'planned'),
      stat(money(s.spent), 'spent so far'),
      stat(money(s.left), s.left < 0 ? 'more than planned' : 'left of the plan'),
    ]),
    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Spent something?' }),
      el('div', { class: 'row' }, [spendCat, spendAmount, el('div', { style: { flex: '1 1 160px' } }, [spendNote]), el('button', { class: 'btn btn-primary', type: 'button', text: 'Add', 'data-field': 'spend-add', on: { click: doSpend } })]),
    ]),
    el('div', { class: 'panel' }, [
      el('h2', { text: 'By category' }),
      s.rows.length ? el('table', { class: 'plain' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: 'Category' }), el('th', { text: 'Planned' }), el('th', { text: 'Spent' }), el('th', { text: 'Left' })])]),
        el('tbody', {}, s.rows.map((row) => el('tr', {}, [
          el('td', { text: row.category + (row.unplanned ? ' (not planned)' : '') }),
          el('td', { text: money(row.planned) }), el('td', { text: money(row.spent) }),
          el('td', { text: money(row.left), style: row.left < 0 ? { color: 'var(--warn)', fontWeight: '700' } : null }),
        ]))),
      ]) : el('p', { class: 'small muted', text: 'No plan for this month yet. Add the categories you want to keep an eye on.' }),
      el('div', { class: 'row', style: { marginTop: 'var(--space-3)' } }, [el('div', { style: { flex: '1 1 180px' } }, [lineCat]), linePlanned, el('button', { class: 'btn', type: 'button', text: 'Add category', on: { click: () => save(addLine(m, lineCat.value, linePlanned.value)) } })]),
    ]),
    m.lines.length ? planPanel(hub, m, save) : null,
    el('details', { class: 'panel more' }, [
      el('summary', { text: `Income (${money(s.income)})` }),
      m.income.length ? el('ul', { class: 'list' }, m.income.map((x) => el('li', {}, [el('span', { class: 'list__main', text: `${x.what}: ${money(x.amount)}` }), el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => save(removeFrom(m, 'income', x.id)) } })]))) : null,
      el('div', { class: 'row' }, [el('div', { style: { flex: '1 1 180px' } }, [incWhat]), incAmount, el('button', { class: 'btn', type: 'button', text: 'Add income', on: { click: () => save(addIncome(m, incWhat.value, incAmount.value)) } })]),
    ]),
    m.spends.length ? el('details', { class: 'panel more' }, [
      el('summary', { text: `Spending this month (${m.spends.length})` }),
      el('ul', { class: 'list' }, m.spends.slice().reverse().map((x) => el('li', {}, [
        el('span', { class: 'list__main', text: `${x.category}: ${money(x.amount)}${x.note ? ` - ${x.note}` : ''}` }),
        el('span', { class: 'small muted', text: [x.day ? fmtDay(x.day, hub.today()) : null, x.who ? nameOf(hub.people.list(), x.who) : null].filter(Boolean).join(' · ') }),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', on: { click: () => save(removeFrom(m, 'spends', x.id)) } }),
      ]))),
    ]) : null,
    el('p', { class: 'small muted', text: 'Amounts are in your own currency. Nothing connects to a bank - you enter what you want to track.' }),
  ]);
}

/* ------------------------------------------- plan the categories (D-119) */

const openLines = new Set();   // which categories are unfolded, kept while the app is open

function planPanel(hub, m, save) {
  const amount = (value, label, onSet) => el('input', { class: 'input', money: true, inputmode: 'decimal', step: 'any', min: '0', value: value || '', placeholder: '0', 'aria-label': label, style: { maxWidth: '110px' },
    on: { change: (e) => onSet(e.target.value) } });
  const remove = (label, onClick) => el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${label}`, on: { click: onClick } });
  const line = (l) => {
    const newName = el('input', { class: 'input', placeholder: 'Something else', 'aria-label': `New item in ${l.category}`, style: { flex: '1 1 140px' } });
    const newAmount = el('input', { class: 'input', money: true, inputmode: 'decimal', step: 'any', min: '0', placeholder: 'R', 'aria-label': 'Its amount', style: { maxWidth: '110px' } });
    const isFood = !l.off && (/food|grocer/i.test(l.category) || (l.items ?? []).some((x) => /grocer/i.test(x.name)));
    return el('details', { class: 'fin-group', open: openLines.has(l.id), 'data-field': `line:${l.category}`,
      on: { toggle: (e) => { if (e.currentTarget.open) openLines.add(l.id); else openLines.delete(l.id); } } }, [
      el('summary', { text: l.off ? `${l.category} - we don’t have this` : `${l.category} · ${money(plannedOf(l))}` }),
      el('div', { class: 'stack', style: { marginTop: 'var(--space-2)' } }, [
        el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
          el('input', { class: 'input', value: l.category, 'aria-label': 'Category name', style: { flex: '1 1 160px' }, on: { change: (e) => save(setLine(m, l.id, { category: e.target.value })) } }),
          el('label', { class: 'checkline small' }, [el('input', { type: 'checkbox', checked: !!l.off, 'data-field': `off:${l.category}`, on: { change: (e) => save(setLine(m, l.id, { off: e.target.checked })) } }), 'We don’t have this']),
          remove(l.category, () => save(removeFrom(m, 'lines', l.id))),
        ]),
        ...(l.off ? [] : [
          ...(l.items?.length ? l.items.map((x) => el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
            el('input', { class: 'input', value: x.name, 'aria-label': 'Item name', style: { flex: '1 1 140px' }, on: { change: (e) => save(setItem(m, l.id, x.id, { name: e.target.value })) } }),
            amount(x.planned, `${x.name} a month`, (v) => save(setItem(m, l.id, x.id, { planned: v }))),
            remove(x.name, () => save(removeItem(m, l.id, x.id))),
          ])) : [el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [el('span', { class: 'small', text: 'Planned' }), amount(l.planned, `${l.category} a month`, (v) => save(setLine(m, l.id, { planned: Number(v) || 0 })))])]),
          el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [newName, newAmount, el('button', { class: 'btn btn-small', type: 'button', text: 'Add item', on: { click: () => save(addItem(m, l.id, newName.value, newAmount.value)) } })]),
          isFood ? foodPanel(hub, m, l, save) : null,
        ]),
      ]),
    ]);
  };
  return el('div', { class: 'panel stack', 'data-field': 'plan-panel' }, [
    el('h2', { text: 'Plan the categories', style: { margin: 0 } }),
    el('p', { class: 'small muted', style: { margin: 0 }, text: 'A month for each. Open a category to fill in its items; its plan is their total.' }),
    ...m.lines.map(line),
    el('p', { class: 'small muted', style: { margin: 0 } }, ['Is your salary keeping up with these? ', el('a', { href: '#/salary', text: 'Salary and costs' }), ' takes them from here.']),
  ]);
}

/** What the food money allows for each meal - per person and for the family (D-119). */
function foodPanel(hub, m, l, save) {
  const f = foodSettings({ ...(m.food ?? {}), people: m.food?.people ?? (hub.people.list().length || null) });
  const set = (patch) => save({ ...m, food: { ...f, ...patch } });
  const items = l.items ?? [];
  const grocer = items.find((x) => /grocer/i.test(x.name));
  const food = grocer ? grocer.planned : plannedOf(l);
  const out = items.find((x) => /eating out/i.test(x.name))?.planned ?? 0;
  const r = perMeal(food, f, out);
  const small = (value, label, onSet, max) => el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: 'any', min: '0', max, value: value ?? '', 'aria-label': label, style: { maxWidth: '80px' }, on: { change: (e) => onSet(e.target.value) } });
  return el('div', { class: 'stack', 'data-field': 'food-per-meal', style: { borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)' } }, [
    el('strong', { text: 'Food per meal' }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': `What ${grocer ? grocer.name : l.category} covers` }, [[false, 'Food only'], [true, 'Groceries too']].map(([k, label]) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(f.groceriesToo === k), text: label, title: k ? 'Cleaning, toiletries and the like are in it too' : 'Only food', on: { click: () => set({ groceriesToo: k }) } }))),
    f.groceriesToo ? el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [el('span', { class: 'small', text: 'Of that, cleaning and toiletries: R' }), small(f.cleaning || '', 'Cleaning and toiletries a month', (v) => set({ cleaning: v }))]) : null,
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [el('span', { class: 'small', text: 'People eating at home' }), small(f.people, 'People eating at home', (v) => set({ people: v }))]),
    el('div', { class: 'row', style: { gap: 'var(--space-2)' } }, [
      el('span', { class: 'small', text: 'Share of a day:' }),
      ...Object.entries(MEALS).map(([k, label]) => el('span', { class: 'row', style: { gap: 'var(--space-1)', flexWrap: 'nowrap' } }, [el('span', { class: 'small', text: label }), small(f.shares[k], `${label}, share of a day’s food`, (v) => set({ shares: { ...f.shares, [k]: Number(v) || 0 }, sharesMine: true }), 100), el('span', { class: 'small muted', text: '%' })])),
      el('span', { class: 'fin-tag', text: f.sharesMine ? 'Yours' : 'Estimated - set how your family eats' }),
    ]),
    r ? el('p', { class: 'small', style: { margin: 0 }, text: `${money(Math.round(r.forFood))} for food a month, for ${r.people}: about ${money(Math.round(r.perPersonDay))} a person a day.` }) : el('p', { class: 'small muted', style: { margin: 0 }, text: `Put in the ${grocer ? grocer.name.toLowerCase() : 'food'} amount and how many eat at home to see what each meal allows.` }),
    r ? el('div', { class: 'table-scroll' }, [el('table', { class: 'plain fin-sums' }, [
      el('thead', {}, [el('tr', {}, ['', 'A person', 'The family', 'A month'].map((h, i) => el('th', { class: i ? 'num' : null, text: h })))]),
      el('tbody', {}, r.meals.map((x) => el('tr', {}, [el('td', { text: x.label }), ...[x.perPerson, x.family, x.month].map((v) => el('td', { class: 'num', text: money(Math.round(v)) }))]))),
    ])]) : null,
    r?.dinnersOut ? el('p', { class: 'small', style: { margin: 0 }, text: `Eating out at ${money(r.eatingOut)} a month is about ${Math.round(r.dinnersOut)} family dinners of budget.` }) : null,
    el('p', { class: 'small muted', style: { margin: 0 } }, ['The month for breakfast is what there is for cereal, milk and bread. Plan the meals in ', el('a', { href: '#/mealplan', text: 'Meal Planner' }), '.']),
  ]);
}

const stat = (value, label) => el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: value }), el('div', { class: 'stat__label', text: label })]);

function projectionText(g, today) {
  const p = projection(g, today);
  const rate = g.ratePct ? ` and ${g.kind === 'debt' ? 'the interest' : 'the growth'} stays at ${g.ratePct}% a year` : '';
  if (g.kind === 'saving') {
    if (p.months === 0) return 'Reached - well done.';
    if (!g.monthly && !g.ratePct) return 'Add a monthly amount to see when it could be reached.';
    if (p.months == null) return 'At this rate it would take more than 50 years.';
    return `If ${money(g.monthly)} goes in each month${rate}, it would be reached around ${fmtDay(p.day, today)} (${p.months} months).`;
  }
  if (p.months === 0) return 'Paid off.';
  if (p.months == null && p.minimum) return `At ${money(g.monthly)} a month the interest is more than the payment, so it would never be paid off. More than ${money(p.minimum)} a month would start to reduce it.`;
  if (p.months == null) return 'At this rate it would take more than 50 years.';
  return `Paying ${money(g.monthly)} a month${rate}, it would be paid off around ${fmtDay(p.day, today)} (${p.months} months)${p.interest ? `, with about ${money(p.interest)} in interest` : ''}.`;
}

function goalsScreen(hub) {
  const r = hub.use('goals', async () => {
    let { items } = await goals(hub).list({ limit: 1000 });
    // Rebuilt once when written before the index kept creators and videos (D-112).
    if (items.some((s) => s.ix !== 2)) { await goals(hub).rebuildIndex(); ({ items } = await goals(hub).list({ limit: 1000 })); }
    return Promise.all(items.map(async (s) => normaliseGoal(await goals(hub).get(s.id))));
  });
  if (r.loading) return el('section', { class: 'stack' }, [nav(hub, 'goals'), loading()]);
  if (r.error) return el('section', { class: 'stack' }, [nav(hub, 'goals'), failure(r.error)]);
  const list = r.data.filter((g) => g.id);
  const today = hub.today();
  const people = hub.people.list();
  const totals = goalTotals(list);
  const owner = (o) => (o === 'household' ? 'Household' : nameOf(people, o));

  return el('section', { class: 'stack', 'aria-label': 'Goals' }, [
    nav(hub, 'goals'),
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'Saving towards something, or paying something off - with the arithmetic shown.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('new-goal'), text: 'New goal', 'data-field': 'add-goal' }),
    ]),
    list.length ? el('div', { class: 'stats' }, [stat(money(totals.all.saved), 'saved towards goals'), stat(money(totals.all.owed), 'still owed on debts')]) : null,
    list.length ? el('div', { class: 'cards' }, list.map((g) => el('article', { class: 'card' }, [
      el('div', { class: 'card__label', text: `${GOAL_KINDS[g.kind]} · ${owner(g.owner)}` }),
      el('a', { class: 'card__title', href: hub.href('goal', g.id), text: g.title }),
      el('div', { class: 'card__meta', text: g.kind === 'saving' ? `${money(g.current)} of ${money(g.target)}${progress(g) != null ? ` (${Math.round(progress(g) * 100)}%)` : ''}` : `${money(g.current)} still owed` }),
      g.kind === 'saving' && g.target ? el('div', { class: 'progress', role: 'img', 'aria-label': `${Math.round(progress(g) * 100)} percent` }, [el('div', { class: 'progress__bar', style: { width: `${Math.round(progress(g) * 100)}%` } })]) : null,
      el('p', { class: 'small', text: projectionText(g, today) }),
    ]))) : el('div', { class: 'panel empty' }, [el('p', { text: 'No goals yet. An emergency fund, a holiday, paying off a card - anything you are working towards.' })]),
    el('p', { class: 'small muted', text: 'Projections are arithmetic on the amounts and rates you enter, assuming they stay the same. They are not predictions or financial advice.' }),
  ]);
}

function goalScreen(hub, id) {
  const r = hub.use(`goal:${id}`, () => goals(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This goal no longer exists.' }), el('a', { class: 'btn', href: hub.href('goals'), text: 'Goals' })]);
  const g = normaliseGoal(r.data);
  const amount = el('input', { class: 'input', money: true, step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Amount', style: { maxWidth: '150px' }, 'data-field': 'goal-amount' });
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('goals'), class: 'small', text: '‹ Goals' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: GOAL_KINDS[g.kind] }),
      el('h1', { text: g.title, style: { margin: 0 } }),
      el('p', { text: g.kind === 'saving' ? `${money(g.current)} saved of ${money(g.target)}.` : `${money(g.current)} still owed.` }),
      el('p', { text: projectionText(g, hub.today()) }),
      el('p', { class: 'small muted', text: `Assumptions: ${money(g.monthly)} a month${g.ratePct != null ? `, ${g.ratePct}% a year ${g.kind === 'debt' ? 'interest' : 'growth'}, compounded monthly` : ', no interest or growth'}. Change them in Edit.` }),
      g.notes ? el('p', { text: g.notes }) : null,
      linksView(hub, g),
    ]),
    el('div', { class: 'panel row' }, [
      el('span', { text: g.kind === 'saving' ? 'Put money in:' : 'Made a payment:' }),
      amount,
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Record it', 'data-field': 'goal-record', on: { click: async () => { const next = recordAmount(g, amount.value); if (next !== g) { await saveRecord(hub, goals(hub), next); hub.ui.notice('Recorded.'); } } } }),
    ]),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn', href: hub.href('edit-goal', g.id), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Delete', on: { click: async () => { if (!await confirmAction({ title: `Delete ${g.title}?`, text: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) return; await goals(hub).remove(g.id); hub.invalidate(); hub.go('goals'); } } }),
    ]),
  ]);
}

function goalEdit(hub, id) {
  const r = id ? hub.use(`goal:${id}`, () => goals(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseGoal(r.data) : null;
  const g = existing ?? normaliseGoal({ title: '' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a goal' }),
    recordForm({
      record: { ...g, title: existing ? g.title : '' },
      fields: [
        { key: 'title', label: 'What is it?', required: true, placeholder: 'e.g. Emergency fund' },
        { key: 'kind', label: 'Kind', type: 'select', options: [['saving', 'Saving towards something'], ['debt', 'Paying something off']] },
        { key: 'target', label: 'Target amount (for saving)', type: 'money' },
        { key: 'current', label: 'Saved so far, or still owed', type: 'money' },
        { key: 'monthly', label: 'Amount each month', type: 'money' },
        { key: 'ratePct', label: 'Yearly interest or growth (%)', type: 'number', more: true, hint: 'Optional. Used only for the projection, assumed to stay the same.' },
        { key: 'owner', label: 'Whose goal', type: 'select', options: [['household', 'The household'], ...hub.people.list().map((p) => [p.id, p.name])], more: true },
        { key: 'notes', label: 'Notes', type: 'textarea', more: true },
        ...(hub.creators ? [{ key: 'links', label: 'Creators and videos', type: 'custom', more: true, control: () => linksControl(hub, g) }] : []),
      ],
      onCancel: () => (existing ? hub.go('goal', existing.id) : hub.go('goals')),
      onSave: async (values) => {
        const { links, ...rest } = values;
        const saved = await saveRecord(hub, goals(hub), normaliseGoal({ ...g, ...rest, ...links }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('goal', saved.id); }
      },
    }),
  ]);
}
