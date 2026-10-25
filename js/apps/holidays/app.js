// Holidays: trips and ideas, each with dates, itinerary, packing and budget.
// Screens: list (default), item, new, edit.

import { el } from '../../ui/dom.js';
import { confirmAction } from '../../ui/common.js';
import { fmtDay } from '../../dates.js';
import { loading, failure, recordForm, saveRecord, nameOf } from '../kit.js';
import {
  normaliseTrip, tripSummary, tripText, nights, when, budgetSummary, packingProgress, tripDays, itineraryByDay,
  addCost, addStep, addPacking, toggle, removeFrom, STATUSES, STARTER_PACKING,
} from './logic.js';

const col = (hub) => hub.data.collection('trips', { summary: tripSummary, text: tripText, prefix: 'trp' });
const all = (hub) => hub.use('all', async () => (await col(hub).list({ limit: 100000 })).items);
const money = (n) => (n == null ? '-' : Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

export function render(hub, route) {
  if (route.sub === 'item') return tripScreen(hub, route.rest[0]);
  if (route.sub === 'new') return editScreen(hub, null);
  if (route.sub === 'edit') return editScreen(hub, route.rest[0]);
  return listScreen(hub);
}

function listScreen(hub) {
  const list = all(hub);
  if (list.loading) return loading();
  if (list.error) return failure(list.error);
  const today = hub.today();
  const dates = (s) => (s.startDay ? `${fmtDay(s.startDay, today)}${s.endDay && s.endDay !== s.startDay ? ` - ${fmtDay(s.endDay, today)}` : ''}` : 'no dates yet');
  const group = (title, items) => (items.length ? el('div', { class: 'panel' }, [
    el('h2', { text: title }),
    el('ul', { class: 'list' }, items.map((s) => el('li', {}, [
      el('a', { class: 'list__main', href: hub.href('item', s.id), style: { color: 'inherit', textDecoration: 'none' } }, [
        el('strong', { text: s.title }),
        el('div', { class: 'small muted', text: [s.destination, dates(s), STATUSES[s.status]].filter(Boolean).join(' · ') }),
      ]),
    ]))),
  ]) : null);
  const by = (w) => list.data.filter((s) => when(s, today) === w && s.status !== 'idea').sort((a, b) => String(a.startDay).localeCompare(String(b.startDay)));

  return el('section', { class: 'stack', 'aria-label': 'Holidays' }, [
    el('div', { class: 'row' }, [
      el('p', { class: 'muted', style: { margin: 0, flex: '1 1 260px' }, text: 'Trips you are planning and ideas for one day - with the plan, the packing and the budget in one place.' }),
      el('a', { class: 'btn btn-primary', href: hub.href('new'), text: 'Add a trip or idea', 'data-field': 'add-trip' }),
    ]),
    list.data.length ? null : el('div', { class: 'panel empty' }, [el('p', { text: 'No trips yet. Even "camping, some time in summer" is a good start.' })]),
    group('Happening now', by('now')),
    group('Coming up', by('upcoming')),
    group('Ideas and undated plans', list.data.filter((s) => s.status === 'idea' || (when(s, today) === 'undated' && s.status !== 'done'))),
    group('Been', list.data.filter((s) => s.status === 'done' || (when(s, today) === 'past' && s.status !== 'idea')).sort((a, b) => String(b.startDay).localeCompare(String(a.startDay)))),
  ]);
}

function tripScreen(hub, id) {
  const r = hub.use(`trip:${id}`, () => col(hub).get(id));
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  if (!r.data) return el('div', { class: 'panel empty' }, [el('p', { text: 'This trip no longer exists.' }), el('a', { class: 'btn', href: hub.href(), text: 'Holidays' })]);
  const t = normaliseTrip(r.data);
  const today = hub.today();
  const people = hub.people.list();
  const save = (next) => saveRecord(hub, col(hub), next);
  const b = budgetSummary(t);
  const pack = packingProgress(t);
  const days = tripDays(t);
  const groups = itineraryByDay(t);

  const stepText = el('input', { class: 'input', placeholder: 'What happens', 'aria-label': 'Itinerary item', 'data-field': 'step-text' });
  const stepDay = el('select', { class: 'select', 'aria-label': 'Which day', style: { width: 'auto' } }, [el('option', { value: '', text: 'Any day' }), ...days.map((d) => el('option', { value: d, text: fmtDay(d, today) }))]);
  const stepTime = el('input', { class: 'input', type: 'time', 'aria-label': 'Time', style: { width: 'auto' } });
  const packText = el('input', { class: 'input', placeholder: 'Something to pack', 'aria-label': 'Packing item', 'data-field': 'pack-text' });
  const packWho = el('select', { class: 'select', 'aria-label': 'Whose', style: { width: 'auto' } }, [el('option', { value: '', text: 'Everyone' }), ...people.map((p) => el('option', { value: p.id, text: p.name }))]);
  const costWhat = el('input', { class: 'input', placeholder: 'What it is for', 'aria-label': 'Cost', 'data-field': 'cost-what' });
  const costAmount = el('input', { class: 'input', type: 'number', min: '0', step: 'any', placeholder: 'Amount', 'aria-label': 'Amount', style: { maxWidth: '130px' } });
  const enter = (input, fn) => input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } });
  const doStep = () => save(addStep(t, stepText.value, stepDay.value || null, stepTime.value));
  const doPack = () => save(addPacking(t, packText.value, packWho.value || null));
  const doCost = () => save(addCost(t, costWhat.value, costAmount.value));
  enter(stepText, doStep); enter(packText, doPack); enter(costWhat, doCost); enter(costAmount, doCost);

  return el('section', { class: 'stack' }, [
    el('a', { href: hub.href(), class: 'small', text: '‹ Holidays' }),
    el('div', { class: 'panel stack' }, [
      el('div', { class: 'card__label', text: STATUSES[t.status] }),
      el('h1', { text: t.title, style: { margin: 0 } }),
      el('p', { class: 'small muted', text: [
        t.destination,
        t.startDay ? `${fmtDay(t.startDay, today)}${t.endDay ? ` to ${fmtDay(t.endDay, today)}` : ''}` : 'no dates yet',
        nights(t) != null ? `${nights(t)} night${nights(t) === 1 ? '' : 's'}` : null,
        t.travellers.length ? t.travellers.map((x) => nameOf(people, x)).join(', ') : null,
      ].filter(Boolean).join(' · ') }),
      t.notes ? el('p', { text: t.notes, style: { whiteSpace: 'pre-wrap' } }) : null,
      el('div', { class: 'row' }, [el('a', { class: 'btn btn-small', href: hub.href('edit', t.id), text: 'Edit details' })]),
    ]),

    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Plan' }),
      groups.size ? el('div', { class: 'stack' }, [...groups].map(([d, steps]) => el('div', {}, [
        el('h3', { text: d === 'any' ? 'Any day' : fmtDay(d, today) }),
        el('ul', { class: 'list' }, steps.map((s) => el('li', {}, [
          el('span', { class: 'list__main', text: `${s.time ? `${s.time}  ` : ''}${s.text}` }),
          el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${s.text}`, on: { click: () => save(removeFrom(t, 'itinerary', s.id)) } }),
        ]))),
      ]))) : el('p', { class: 'small muted', text: 'Nothing planned yet - add things to do, places to see, or travel times.' }),
      el('div', { class: 'row' }, [el('div', { style: { flex: '1 1 200px' } }, [stepText]), stepDay, stepTime, el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: doStep } })]),
    ]),

    el('div', { class: 'panel stack' }, [
      el('h2', { text: `Packing${pack.total ? ` (${pack.packed} of ${pack.total} packed)` : ''}` }),
      pack.total ? el('ul', { class: 'list' }, t.packing.map((p) => el('li', {}, [
        el('label', { class: 'checkline list__main' }, [
          el('input', { type: 'checkbox', checked: p.packed, on: { change: () => save(toggle(t, 'packing', p.id, 'packed')) } }),
          el('span', { text: p.text, style: p.packed ? { textDecoration: 'line-through', color: 'var(--text-faint)' } : null }),
          p.who ? el('span', { class: 'small muted', text: ` · ${nameOf(people, p.who)}` }) : null,
        ]),
        el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${p.text}`, on: { click: () => save(removeFrom(t, 'packing', p.id)) } }),
      ]))) : el('div', { class: 'row' }, [
        el('span', { class: 'small muted', text: 'Nothing on the list yet.' }),
        el('button', { class: 'btn btn-small', type: 'button', text: 'Start with a basic list', on: { click: () => save(STARTER_PACKING.reduce((acc, x) => addPacking(acc, x), t)) } }),
      ]),
      el('div', { class: 'row' }, [el('div', { style: { flex: '1 1 200px' } }, [packText]), packWho, el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: doPack } })]),
    ]),

    el('div', { class: 'panel stack' }, [
      el('h2', { text: 'Budget' }),
      el('div', { class: 'stats' }, [
        stat(money(t.budget), 'budget'),
        stat(money(b.planned), 'planned costs'),
        stat(money(b.toPay), 'still to pay'),
        b.left != null ? stat(money(b.left), b.over ? 'over the budget' : 'left in the budget') : null,
      ]),
      b.over ? el('p', { class: 'small', text: 'The planned costs are more than the budget. Worth a look at what could change - or whether the budget should.' }) : null,
      t.costs.length ? el('table', { class: 'plain' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: 'What' }), el('th', { text: 'Amount' }), el('th', { text: 'Paid' }), el('th', { text: '' })])]),
        el('tbody', {}, t.costs.map((c) => el('tr', {}, [
          el('td', { text: c.what }), el('td', { text: money(c.amount) }),
          el('td', {}, [el('input', { type: 'checkbox', checked: c.paid, 'aria-label': `Paid: ${c.what}`, on: { change: () => save(toggle(t, 'costs', c.id, 'paid')) } })]),
          el('td', {}, [el('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Remove', 'aria-label': `Remove ${c.what}`, on: { click: () => save(removeFrom(t, 'costs', c.id)) } })]),
        ]))),
      ]) : null,
      el('div', { class: 'row' }, [el('div', { style: { flex: '1 1 200px' } }, [costWhat]), costAmount, el('button', { class: 'btn', type: 'button', text: 'Add', on: { click: doCost } })]),
      el('p', { class: 'small muted', text: 'Amounts are your own estimates, in your own currency.' }),
    ]),

    el('button', {
      class: 'btn btn-danger', type: 'button', text: 'Delete this trip',
      on: { click: async () => { if (!await confirmAction({ title: `Delete ${t.title}?`, text: 'Marking it "Been" keeps the memory instead.', confirmLabel: 'Delete', danger: true })) return; await col(hub).remove(t.id); hub.invalidate(); hub.go(null); } },
    }),
  ]);
}

const stat = (value, label) => el('div', { class: 'stat' }, [el('div', { class: 'stat__value', text: value }), el('div', { class: 'stat__label', text: label })]);

function editScreen(hub, id) {
  const r = id ? hub.use(`trip:${id}`, () => col(hub).get(id)) : { data: null };
  if (r.loading) return loading();
  if (r.error) return failure(r.error);
  const existing = r.data ? normaliseTrip(r.data) : null;
  const rec = existing ?? normaliseTrip({ title: '' });
  return el('section', { class: 'stack' }, [
    el('h1', { text: existing ? `Edit ${existing.title}` : 'Add a trip or idea' }),
    recordForm({
      record: { ...rec, title: existing ? rec.title : '' },
      people: hub.people.list(),
      fields: [
        { key: 'title', label: 'Name it', required: true, placeholder: 'e.g. Beach week' },
        { key: 'status', label: 'Where it is at', type: 'select', options: Object.entries(STATUSES) },
        { key: 'destination', label: 'Where' },
        { key: 'startDay', label: 'From', type: 'day' },
        { key: 'endDay', label: 'To', type: 'day' },
        { key: 'travellers', label: 'Who is going', type: 'people', more: true },
        { key: 'budget', label: 'Budget', type: 'number', more: true },
        { key: 'notes', label: 'Notes, ideas, bookings', type: 'textarea', more: true },
      ],
      onCancel: () => (existing ? hub.go('item', existing.id) : hub.go(null)),
      onSave: async (values) => {
        const saved = await saveRecord(hub, col(hub), normaliseTrip({ ...rec, ...values }));
        if (saved) { hub.ui.notice('Saved.'); hub.go('item', saved.id); }
      },
    }),
  ]);
}
