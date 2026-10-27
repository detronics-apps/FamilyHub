// Finance: this month's budget (planned against actual) and savings and debt
// goals. Every projection shows the assumptions it rests on.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { tabs, loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  monthId, monthOf, shiftMonth, normaliseMonth, monthSummary, copyMonth, addSpend, addLine, addIncome, removeFrom,
  normaliseGoal, goalSummary, projection, progress, recordAmount, goalTotals, GOAL_KINDS,
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

  const spendCat = el('select', { class: 'select', 'aria-label': 'Category', style: { width: 'auto' } }, [...m.lines.map((l) => el('option', { value: l.category, text: l.category })), el('option', { value: 'Other', text: 'Other' })]);
  const spendAmount = el('input', { class: 'input', type: 'number', step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Amount spent', style: { maxWidth: '130px' }, 'data-field': 'spend-amount' });
  const spendNote = el('input', { class: 'input', placeholder: 'What for (optional)', 'aria-label': 'What it was for' });
  const doSpend = () => save(addSpend(m, { category: spendCat.value, amount: spendAmount.value, note: spendNote.value, day: hub.today(), who: me?.id ?? null }));
  const lineCat = el('input', { class: 'input', placeholder: 'Category, e.g. Groceries', 'aria-label': 'New category' });
  const linePlanned = el('input', { class: 'input', type: 'number', step: 'any', min: '0', placeholder: 'Planned', 'aria-label': 'Planned amount', style: { maxWidth: '130px' } });
  const incWhat = el('input', { class: 'input', placeholder: 'Income, e.g. Salary', 'aria-label': 'Income source' });
  const incAmount = el('input', { class: 'input', type: 'number', step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Income amount', style: { maxWidth: '130px' } });

  return el('section', { class: 'stack', 'aria-label': 'Budget' }, [
    nav(hub, null),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn-small', href: hub.href('month', shiftMonth(month, -1)), text: '‹', 'aria-label': 'Previous month' }),
      el('strong', { text: monthName(month), style: { flex: '1 1 auto', textAlign: 'center' } }),
      el('a', { class: 'btn btn-small', href: hub.href('month', shiftMonth(month, 1)), text: '›', 'aria-label': 'Next month' }),
    ]),
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
    const { items } = await goals(hub).list({ limit: 1000 });
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
  const amount = el('input', { class: 'input', type: 'number', step: 'any', min: '0', placeholder: 'Amount', 'aria-label': 'Amount', style: { maxWidth: '150px' }, 'data-field': 'goal-amount' });
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href('goals'), class: 'small', text: '‹ Goals' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: GOAL_KINDS[g.kind] }),
      el('h1', { text: g.title, style: { margin: 0 } }),
      el('p', { text: g.kind === 'saving' ? `${money(g.current)} saved of ${money(g.target)}.` : `${money(g.current)} still owed.` }),
      el('p', { text: projectionText(g, hub.today()) }),
      el('p', { class: 'small muted', text: `Assumptions: ${money(g.monthly)} a month${g.ratePct != null ? `, ${g.ratePct}% a year ${g.kind === 'debt' ? 'interest' : 'growth'}, compounded monthly` : ', no interest or growth'}. Change them in Edit.` }),
      g.notes ? el('p', { text: g.notes }) : null,
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
        { key: 'target', label: 'Target amount (for saving)', type: 'number' },
        { key: 'current', label: 'Saved so far, or still owed', type: 'number' },
        { key: 'monthly', label: 'Amount each month', type: 'number' },
        { key: 'ratePct', label: 'Yearly interest or growth (%)', type: 'number', more: true, hint: 'Optional. Used only for the projection, assumed to stay the same.' },
        { key: 'owner', label: 'Whose goal', type: 'select', options: [['household', 'The household'], ...hub.people.list().map((p) => [p.id, p.name])], more: true },
        { key: 'notes', label: 'Notes', type: 'textarea', more: true },
      ],
      onCancel: () => (existing ? hub.go('goal', existing.id) : hub.go('goals')),
      onSave: async (values) => {
        const saved = await saveRecord(hub, goals(hub), normaliseGoal({ ...g, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('goal', saved.id); }
      },
    }),
  ]);
}
