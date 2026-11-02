// Goals (D-102): the dreams and goals you share. Screens: the list (default), one goal, the form.
// A goal that needs money links to its Finance goal, a trip to its Holiday - nothing is copied.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { loading, failure, recordForm, saveRecord } from '../kit.js';
import { STATUS, normaliseGoal, grouped, setStatus, moneyLine } from './logic.js';

const col = (hub) => hub.data.collection('goals', { summary: (r) => normaliseGoal(r), text: (r) => [r.name, r.why].join(' '), prefix: 'og' });
const load = (hub) => hub.use('all', async () => {
  const [g, f, t] = await Promise.all([
    col(hub).list({ limit: 10000 }),
    hub.data.installed('finance') ? hub.data.of('finance', 'goals').list({ limit: 1000 }) : { items: [] },
    hub.data.installed('holidays') ? hub.data.of('holidays', 'trips').list({ limit: 1000 }) : { items: [] },
  ]);
  return { goals: g.items.map(normaliseGoal), finance: f.items, trips: t.items };
});
const save = (hub, g) => saveRecord(hub, col(hub), normaliseGoal({ ...g, id: `og_${g.goalId}` }));

export function tileNote(hub) {
  const r = load(hub);
  if (!r.data) return null;
  const n = r.data.goals.filter((g) => g.status === 'doing').length;
  return n ? `${n} on the go` : null;
}

export function render(hub, route) {
  const r = load(hub);
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (route.sub === 'goal') return goalScreen(hub, r.data, route.rest[0]);
  if (route.sub === 'edit') return editScreen(hub, r.data, route.rest[0]);
  if (route.sub === 'new') return editScreen(hub, r.data, null);
  return listScreen(hub, r.data);
}

const linksOf = (data, g) => [
  g.financeGoal ? (() => { const f = data.finance.find((x) => x.id === g.financeGoal); return f ? el('span', {}, ['Money: ', el('a', { href: `#/finance/goal/${encodeURIComponent(f.id)}`, text: f.title }), moneyLine(f) ? ` - ${moneyLine(f)}` : '']) : null; })() : null,
  g.trip ? (() => { const t = data.trips.find((x) => x.id === g.trip); return t ? el('span', {}, ['Trip: ', el('a', { href: `#/holidays/item/${encodeURIComponent(t.id)}`, text: t.title })]) : null; })() : null,
].filter(Boolean);

function listScreen(hub, data) {
  const gr = grouped(data.goals);
  const row = (g) => el('li', {}, [el('a', { class: 'list__main', href: hub.href('goal', g.goalId), style: { color: 'inherit', textDecoration: 'none' }, 'data-field': `goal:${g.goalId}` }, [
    el('strong', { text: g.name }),
    el('div', { class: 'small muted', text: [g.by ? `by ${g.by}` : null, g.next ? `next: ${g.next}` : null, g.doneOn ? `done ${g.doneOn}` : null].filter(Boolean).join(' · ') }),
  ]), ...linksOf(data, g).map((n) => el('div', { class: 'small' }, [n]))]);
  const block = (key, help) => (gr[key].length ? el('div', { class: 'panel stack', 'data-field': `goals-${key}` }, [el('h2', { text: STATUS[key], style: { margin: 0 } }), help ? el('p', { class: 'small muted', style: { margin: 0 }, text: help }) : null, el('ul', { class: 'list' }, gr[key].map(row))]) : null);
  return el('section', { class: 'stack', 'aria-label': 'Goals' }, [
    el('p', { class: 'muted', style: { margin: 0 }, text: 'Dreams and goals the two of you share - why each matters, and the next small step.' }),
    el('div', { class: 'row' }, [el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add', title: 'Add a goal or dream', 'data-field': 'goal-add' })]),
    data.goals.length ? null : el('div', { class: 'panel empty' }, [el('p', { text: 'Nothing yet. A trip, something to learn together, a house project, a weekend away each year…' })]),
    block('doing'), block('planning'), block('someday', 'One day - no date needed.'),
    gr.done.length ? el('details', { class: 'panel more' }, [el('summary', { text: `Done (${gr.done.length})` }), el('ul', { class: 'list' }, gr.done.map(row))]) : null,
  ]);
}

function goalScreen(hub, data, id) {
  const g = data.goals.find((x) => x.goalId === id);
  if (!g) return el('div', { class: 'panel empty' }, [el('p', { text: 'This goal was removed.' }), el('a', { class: 'btn', href: hub.href(), text: 'Goals' })]);
  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Goals' }),
    el('h1', { text: g.name, style: { margin: 0 } }),
    el('div', { class: 'chipset', role: 'group', 'aria-label': 'Where it stands' }, Object.entries(STATUS).map(([k, t]) => el('button', {
      class: 'chip', type: 'button', text: t, 'aria-pressed': String(g.status === k), 'data-field': `goal-status:${k}`,
      on: { click: () => save(hub, setStatus(g, k, hub.today())) } }))),
    g.why ? el('div', { class: 'panel' }, [el('h2', { text: 'Why it matters', style: { margin: 0 } }), el('p', { text: g.why, style: { whiteSpace: 'pre-wrap', margin: '6px 0 0' } })]) : null,
    el('p', { style: { margin: 0 } }, [el('strong', { text: 'Next step: ' }), g.next || 'not set yet']),
    g.by ? el('p', { style: { margin: 0 } }, [el('strong', { text: 'By: ' }), g.by]) : null,
    g.doneOn ? el('p', { class: 'fin-better', style: { margin: 0 }, text: `Done on ${g.doneOn}.` }) : null,
    ...linksOf(data, g).map((n) => el('p', { style: { margin: 0 } }, [n])),
    el('div', { class: 'row' }, [el('a', { class: 'btn', href: hub.href('edit', g.goalId), text: 'Edit' }),
      el('button', { class: 'btn btn-quiet', type: 'button', text: 'Remove', on: { click: async () => {
        if (!await confirmAction({ title: `Remove "${g.name}"?`, text: 'The Finance goal or trip it links to stays.', confirmLabel: 'Remove', danger: true })) return;
        await col(hub).remove(`og_${g.goalId}`); hub.invalidate(); hub.go(null);
      } } })]),
  ]);
}

function editScreen(hub, data, id) {
  const g = id ? data.goals.find((x) => x.goalId === id) : null;
  return el('section', { class: 'stack' }, [
    el('h1', { text: g ? `Edit ${g.name}` : 'A goal or dream' }),
    recordForm({
      record: g ?? { status: 'someday' },
      fields: [
        { key: 'name', label: 'The goal', required: true, placeholder: 'e.g. A weekend away every year' },
        { key: 'why', label: 'Why it matters to us', type: 'textarea' },
        { key: 'next', label: 'The next small step', placeholder: 'e.g. Choose three places' },
        { key: 'status', label: 'Where it stands', type: 'select', options: Object.entries(STATUS) },
        { key: 'by', label: 'By when (if there is a date)', type: 'day' },
        data.finance.length ? { key: 'financeGoal', label: 'The money for it (a Finance goal)', type: 'select', options: [['', 'None'], ...data.finance.map((f) => [f.id, f.title])], more: true, hint: 'The amounts stay in Finance; this only links to them.' } : null,
        data.trips.length ? { key: 'trip', label: 'The trip (in Holidays)', type: 'select', options: [['', 'None'], ...data.trips.map((t) => [t.id, t.title])], more: true } : null,
      ].filter(Boolean),
      onCancel: () => (g ? hub.go('goal', g.goalId) : hub.go(null)),
      onSave: async (v) => {
        const goalId = g?.goalId ?? `goal-${Date.now().toString(36)}`;
        const next = setStatus({ ...(g ?? {}), ...v, goalId }, v.status ?? 'someday', hub.today());
        if (await save(hub, next)) { hub.ui.notice('Saved.'); hub.go('goal', goalId); }
      },
    }),
  ]);
}
